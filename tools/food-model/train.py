#!/usr/bin/env python3
"""Teaches the photo recogniser the foods in classes.csv and exports it for the web app.

The recogniser is DINOv2 ViT-S/14 (Meta, Apache 2.0), a small vision network that turns a photo
into numbers describing it, kept as it is, plus two single-layer heads trained here:

- a photo head: for every food, how likely the photo shows it (several foods can be on one plate);
- a patch head: for each of the 16 x 16 squares of the photo, which food it shows, or none. Counting
  the squares tells how much of the photo each food covers, which scales its suggested weight.

Only the heads learn, so training runs on a laptop's processor. Steps: read the photos fetched by
fetch_datasets.py, describe each once with DINOv2 (cached), train the heads, measure them on photos
kept aside, then write web/public/models/food-recognizer.onnx and food-classes.json.

Usage: python3 tools/food-model/train.py ~/.cache/fit-os/food-model
"""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import torch
from PIL import Image
from transformers import Dinov2Model

VERSION = 4  # raise it with every new model, so phones replace their cached copy
HERE = Path(__file__).parent
WEB = HERE.parent.parent / "web" / "public" / "models"
SIZE = 224
GRID = SIZE // 14  # 16 x 16 patches
PATCHES_KEPT = 48  # patches per boxed photo kept for the patch head, half on food and half off
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
N5K_VISIBLE_SHARE = 0.1  # an ingredient counts as visible from 10% of the plate's weight
N5K_VISIBLE_GRAMS = 10
THRESHOLD = 0.3  # a food is listed from this likelihood up; the most likely one is always listed


def held_out(key):
    """One photo in ten, chosen by name so it stays the same between runs, is kept for testing."""
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % 10 == 0


class Sources:
    """Every training photo as (key, path, class ids, boxes, is_test). Boxes are [x, y, w, h, class] in pixels."""

    def __init__(self, root):
        self.root = root
        self.classes = list(csv.DictReader(open(HERE / "classes.csv")))
        self.index = {c["id"]: i for i, c in enumerate(self.classes)}
        self.items = []
        self.commons_rows = []  # attribution of the Commons photos learned from
        self.n5k_grams = {}  # weighed grams of each of our foods on a Nutrition5k plate
        self.mfr()
        self.n5k()
        self.open_images()
        self.coco()
        self.commons()

    def labels(self, column):
        return {label: c["id"] for c in self.classes for label in filter(None, c[column].split("|"))}

    def mfr(self):
        """The parquet files hold the photos themselves; they are written out once as files."""
        labels = self.labels("mfr")
        folder = self.root / "mfr" / "images"
        folder.mkdir(exist_ok=True)
        for path in sorted((self.root / "mfr").glob("*.parquet")):
            if path.name.startswith("test"):
                continue
            for batch in pq.ParquetFile(path).iter_batches(batch_size=256, columns=["image_id", "image", "objects", "name_label"]):
                for row in batch.to_pylist():
                    photo = folder / str(row["image_id"])
                    if not photo.exists():
                        photo.write_bytes(row["image"]["bytes"])
                    found = sorted({labels[x.strip()] for x in row["name_label"].split(";") if x.strip()})
                    boxes = [[*row["objects"]["bbox"][0], found[0]]] if len(found) == 1 else []
                    self.items.append((f"mfr/{row['image_id']}", photo, found, boxes, path.name.startswith("validation")))

    def n5k(self):
        labels = self.labels("n5k")
        folder = self.root / "n5k"
        for name in ["dish_metadata_cafe1.csv", "dish_metadata_cafe2.csv"]:
            for row in csv.reader(open(folder / name)):
                photo = folder / "rgb" / f"{row[0]}.png"
                if not photo.exists():
                    continue
                mass = float(row[2]) or 1
                weighed = {}
                for i in range(6, len(row) - 6, 7):
                    grams = float(row[i + 2])
                    if row[i + 1] in labels and grams >= N5K_VISIBLE_SHARE * mass and grams >= N5K_VISIBLE_GRAMS:
                        weighed[labels[row[i + 1]]] = weighed.get(labels[row[i + 1]], 0) + grams
                if weighed:
                    self.n5k_grams[f"n5k/{row[0]}"] = weighed
                    self.items.append((f"n5k/{row[0]}", photo, sorted(weighed), [], held_out(row[0])))

    def open_images(self):
        folder = self.root / "oi"
        for image, classes in csv.reader(open(folder / "labels.csv")):
            photo = folder / "images" / f"{image}.jpg"
            if photo.exists():
                self.items.append((f"oi/{image}", photo, classes.split("|"), [], held_out(image)))

    def coco(self):
        folder = self.root / "coco"
        for entry in json.load(open(folder / "boxes.json")):
            photo = folder / "images" / entry["file"]
            if photo.exists():
                found = sorted({b[4] for b in entry["boxes"]})
                self.items.append((f"coco/{entry['file']}", photo, found, entry["boxes"], held_out(entry["file"])))


    def commons(self):
        """Wikimedia Commons photos of Italian dishes, each with its own licence; see fetch_commons.py."""
        folder = self.root / "commons"
        table = folder / "attribution.csv"
        if not table.exists():
            return
        self.commons_rows = []
        for row in csv.DictReader(open(table)):
            photo = folder / "images" / row["file"]
            found = [c for c in row["classes"].split("|") if c in self.index]
            if photo.exists() and found:
                self.commons_rows.append(row)
                self.items.append((f"commons/{row['file']}", photo, found, [], held_out(row["file"])))


def to_input(image):
    """The photo squeezed to 224 x 224 (nothing cropped away), as 0..1 RGB, the same as the app does."""
    image = image.convert("RGB").resize((SIZE, SIZE), Image.BILINEAR)
    return torch.from_numpy(np.asarray(image, dtype=np.float32) / 255).permute(2, 0, 1)


def patch_labels(boxes, width, height, background):
    """Which class each patch shows: the smallest box covering its centre, else background."""
    labels = np.full(GRID * GRID, background, dtype=np.int64)
    area = np.full(GRID * GRID, np.inf)
    centres = (np.arange(GRID) + 0.5) / GRID
    cx, cy = np.meshgrid(centres * width, centres * height)
    cx, cy = cx.ravel(), cy.ravel()
    for x, y, w, h, cls in boxes:
        inside = (cx >= x) & (cx <= x + w) & (cy >= y) & (cy <= y + h) & (w * h < area)
        labels[inside] = cls
        area[inside] = w * h
    return labels


class Backbone(torch.nn.Module):
    """DINOv2 with the pixel normalisation built in, so the app passes plain 0..1 RGB."""

    def __init__(self):
        super().__init__()
        self.dino = Dinov2Model.from_pretrained("facebook/dinov2-small")
        self.register_buffer("mean", torch.tensor(MEAN).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor(STD).view(1, 3, 1, 1))

    def forward(self, pixels):
        tokens = self.dino(pixel_values=(pixels - self.mean) / self.std).last_hidden_state
        return tokens[:, 0], tokens[:, 1:]


class Photos(torch.utils.data.Dataset):
    def __init__(self, sources):
        self.sources = sources

    def __len__(self):
        return len(self.sources.items)

    def __getitem__(self, i):
        _, path, _, boxes, _ = self.sources.items[i]
        background = len(self.sources.classes)
        try:
            image = Image.open(path)
            pixels = to_input(image)
        except Exception:
            return i, torch.zeros(3, SIZE, SIZE), torch.full((GRID * GRID,), -1), False
        boxed = [[x, y, w, h, self.sources.index[c]] for x, y, w, h, c in boxes]
        if not boxed:
            return i, pixels, torch.full((GRID * GRID,), -1), True
        return i, pixels, torch.from_numpy(patch_labels(boxed, *image.size, background)), True


def describe(sources, cache):
    """DINOv2 numbers for every photo, worked out once and cached on disk."""
    if cache.exists():
        return dict(np.load(cache))
    backbone = Backbone().eval()
    background = len(sources.classes)
    n = len(sources.items)
    photo = np.zeros((n, 768), dtype=np.float16)
    readable = np.zeros(n, dtype=bool)
    share = np.full(n, np.nan, dtype=np.float32)  # part of the photo inside the food's box
    kept_tokens, kept_labels, kept_owner = [], [], []
    rng = np.random.default_rng(7)
    loader = torch.utils.data.DataLoader(Photos(sources), batch_size=64, num_workers=6)
    with torch.inference_mode():
        for step, (index, pixels, labels, ok) in enumerate(loader):
            cls, patches = backbone(pixels)
            photo[index.numpy()] = torch.cat([cls, patches.mean(1)], 1).numpy()
            readable[index.numpy()] = ok.numpy()
            for row in range(len(index)):
                if labels[row, 0] < 0:
                    continue
                lab = labels[row].numpy()
                food, empty = np.flatnonzero(lab != background), np.flatnonzero(lab == background)
                share[index[row]] = len(food) / len(lab)
                pick = np.concatenate([rng.permutation(food)[: PATCHES_KEPT // 2], rng.permutation(empty)[: PATCHES_KEPT // 2]])
                kept_tokens.append(patches[row, pick].numpy().astype(np.float16))
                kept_labels.append(lab[pick])
                kept_owner.append(np.full(len(pick), index[row].item()))
            if step % 50 == 0:
                print(f"described {min((step + 1) * 64, n)} of {n} photos", flush=True)
    data = {
        "photo": photo,
        "readable": readable,
        "share": share,
        "patch": np.concatenate(kept_tokens),
        "patch_label": np.concatenate(kept_labels),
        "patch_owner": np.concatenate(kept_owner),
    }
    np.savez(cache, **data)
    return data


def train_head(x, y, outputs, multi_label, epochs):
    """A single linear layer, trained with AdamW on the cached numbers."""
    torch.manual_seed(7)
    head = torch.nn.Linear(x.shape[1], outputs)
    optimiser = torch.optim.AdamW(head.parameters(), lr=1e-3, weight_decay=1e-4)
    schedule = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, epochs)
    x = torch.from_numpy(x.astype(np.float32))
    y = torch.from_numpy(y)
    loss_of = torch.nn.BCEWithLogitsLoss() if multi_label else torch.nn.CrossEntropyLoss(label_smoothing=0.1)
    for _ in range(epochs):
        for batch in torch.randperm(len(x)).split(512):
            optimiser.zero_grad()
            loss_of(head(x[batch]), y[batch]).backward()
            optimiser.step()
        schedule.step()
    return head.eval()


def evaluate(sources, data, photo_head, patch_head, use):
    """How often the recogniser is right on photos it never saw, by source."""
    with torch.no_grad():
        probs = torch.sigmoid(photo_head(torch.from_numpy(data["photo"].astype(np.float32)))).numpy()
    report = {}
    for source in ["mfr", "n5k", "oi", "coco", "commons", "all"]:
        rows = [i for i, item in enumerate(sources.items) if use[i] and item[4] and (source == "all" or item[0].startswith(source + "/"))]
        if not rows:
            continue
        top1 = top3 = single = hits = guesses = truths = 0
        for i in rows:
            truth = {sources.index[c] for c in sources.items[i][2]}
            order = np.argsort(-probs[i])
            if len(truth) == 1:
                single += 1
                top1 += order[0] in truth
                top3 += bool(truth & set(order[:3]))
            guess = set(np.flatnonzero(probs[i] >= THRESHOLD)) or {order[0]}
            hits += len(truth & guess)
            guesses += len(guess)
            truths += len(truth)
        report[source] = {
            "photos": len(rows),
            "single_food_photos": single,
            "top1": round(top1 / max(single, 1), 3),
            "top3": round(top3 / max(single, 1), 3),
            "precision": round(hits / guesses, 3),
            "recall": round(hits / truths, 3),
        }
    test = np.array([item[4] for item in sources.items])[data["patch_owner"]]
    with torch.no_grad():
        guess = patch_head(torch.from_numpy(data["patch"][test].astype(np.float32))).argmax(1).numpy()
    report["patches"] = {"patches": int(test.sum()), "accuracy": round(float((guess == data["patch_label"][test]).mean()), 3)}
    return report


class Recogniser(torch.nn.Module):
    """What the app runs: photo in, food likelihoods and the food of each patch out."""

    def __init__(self, backbone, photo_head, patch_head):
        super().__init__()
        self.backbone, self.photo_head, self.patch_head = backbone, photo_head, patch_head

    def forward(self, pixels):
        cls, patches = self.backbone(pixels)
        foods = torch.sigmoid(self.photo_head(torch.cat([cls, patches.mean(1)], 1)))
        return foods, torch.softmax(self.patch_head(patches), -1)


def check_quantized(sources, photo_head, path, photos=500):
    """Top-1 of the shipped 8-bit model against the full one, on held-out single-food MyFoodRepo photos."""
    import onnxruntime

    session = onnxruntime.InferenceSession(str(path))
    backbone = Backbone().eval()
    picked = [item for item in sources.items if item[0].startswith("mfr/") and item[4] and len(item[2]) == 1][:photos]
    full = small = 0
    with torch.no_grad():
        for _, photo, found, _, _ in picked:
            pixels = to_input(Image.open(photo))[None]
            cls, patches = backbone(pixels)
            truth = sources.index[found[0]]
            full += int(photo_head(torch.cat([cls, patches.mean(1)], 1)).argmax()) == truth
            small += int(session.run(["foods"], {"pixels": pixels.numpy()})[0].argmax()) == truth
    return {"photos": len(picked), "top1_full": round(full / len(picked), 3), "top1_8bit": round(small / len(picked), 3)}


def usual_shares(sources, data, use):
    """For each food, the median part of a photo its box covers when it is alone in a training photo; None below 5 photos."""
    shares = []
    for c in sources.classes:
        seen = [data["share"][j] for j, item in enumerate(sources.items)
                if use[j] and not item[4] and item[2] == [c["id"]] and not np.isnan(data["share"][j])]
        shares.append(round(float(np.median(seen)), 3) if len(seen) >= 5 else None)
    return shares


def usual_grams(food_class):
    return sum(float(part.split(":")[1]) for part in food_class["foods"].split())


def check_weights(sources, model, shares, photos=300):
    """
    How far the suggested grams are from the weighed ones on held-out Nutrition5k plates, for the
    foods that were found: with each food's usual portion, and scaled by the photo as the app does.
    """
    picked = [item for item in sources.items if item[0].startswith("n5k/") and item[4]][:photos]
    usual_error, scaled_error = [], []
    with torch.no_grad():
        for key, photo, _, _, _ in picked:
            foods, patches = model(to_input(Image.open(photo))[None])
            foods, cells = foods[0].numpy(), patches[0].argmax(-1).numpy()
            for cls, grams in sources.n5k_grams[key].items():
                i = sources.index[cls]
                usual = usual_grams(sources.classes[i])
                if foods[i] < THRESHOLD or not usual:
                    continue
                coverage = float((cells == i).mean())
                scale = min(1.6, max(0.6, (coverage / shares[i]) ** 0.5)) if shares[i] and coverage > 0 else 1
                usual_error.append(abs(usual - grams) / grams)
                scaled_error.append(abs(usual * scale - grams) / grams)
    return {
        "foods": len(usual_error),
        "median_error_usual_portion": round(float(np.median(usual_error)), 3),
        "median_error_scaled": round(float(np.median(scaled_error)), 3),
    }


CC_BY = ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/")
CC_BY_SA = ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")


def write_licence(sources):
    """
    The terms of the model files, and who took the Wikimedia Commons photos it learned from. A model
    that learned from ShareAlike photos is shared under the same licence; otherwise CC BY is enough.
    """
    share_alike = any(re.search(r"\bSA\b", row["licence"]) for row in sources.commons_rows)
    name, link = CC_BY_SA if share_alike else CC_BY
    (WEB / "LICENSE.md").write_text(
        f"# Photo food recogniser\n\n`food-recognizer.onnx` and `food-classes.json` are licensed under [{name}]({link}).\n\n"
        "They were trained on the photos credited in the app's Terms of Service and, for the ones from Wikimedia\n"
        "Commons, in `ATTRIBUTION.csv` (author, licence and page of each photo). The backbone is DINOv2 (Meta,\n"
        "Apache License 2.0) and the heads were trained from `tools/food-model` in the repository.\n\n"
        "You may share and adapt them, also commercially, if you credit the sources, link the licence, say what you\n"
        + ("changed, and share your version under the same licence.\n" if share_alike else "changed.\n")
    )
    with open(WEB / "ATTRIBUTION.csv", "w", newline="") as out:
        writer = csv.writer(out)
        writer.writerow(["title", "author", "licence", "licence_url", "page"])
        for row in sorted(sources.commons_rows, key=lambda r: r["page"]):
            writer.writerow([row[k] for k in ["title", "author", "licence", "licence_url", "page"]])


def export(sources, data, photo_head, patch_head, report, use):
    from onnxruntime.quantization import QuantType, quantize_dynamic

    WEB.mkdir(parents=True, exist_ok=True)
    model = Recogniser(Backbone().eval(), photo_head, patch_head).eval()
    shares = usual_shares(sources, data, use)
    report["weights"] = check_weights(sources, model, shares)
    full = sources.root / "food-recognizer-fp32.onnx"
    torch.onnx.export(model, torch.rand(1, 3, SIZE, SIZE), full, input_names=["pixels"], output_names=["foods", "patches"],
                      opset_version=17, dynamo=False)
    # 8-bit weights, one scale per output channel: 23 MB instead of 85, within the host's 25 MB limit per file.
    quantize_dynamic(full, WEB / "food-recognizer.onnx", weight_type=QuantType.QInt8, per_channel=True)
    report["quantized"] = check_quantized(sources, photo_head, WEB / "food-recognizer.onnx")
    classes = [{
        "id": c["id"],
        "name": c["name"],
        "foods": [{"code": code, "grams": float(grams)} for code, grams in (part.split(":") for part in c["foods"].split())],
        # The usual part of a photo this food covers when it is alone in it; null when unknown.
        "share": share,
    } for c, share in zip(sources.classes, shares)]
    meta = {"version": VERSION, "size": SIZE, "grid": GRID, "threshold": THRESHOLD, "classes": classes, "evaluation": report}
    json.dump(meta, open(WEB / "food-classes.json", "w"), indent=1, ensure_ascii=False)
    write_licence(sources)


if __name__ == "__main__":
    root = Path(sys.argv[1]).expanduser()
    torch.set_num_threads(10)
    sources = Sources(root)
    print(len(sources.items), "photos,", sum(item[4] for item in sources.items), "kept for testing", flush=True)
    # The cache is named after the photos in it, so adding or removing a source describes again.
    names = hashlib.md5("\n".join(item[0] for item in sources.items).encode()).hexdigest()[:10]
    data = describe(sources, root / f"features-{names}.npz")
    use = data["readable"]
    test = np.array([item[4] for item in sources.items])
    train = use & ~test
    targets = np.zeros((len(sources.items), len(sources.classes)), dtype=np.float32)
    for i, item in enumerate(sources.items):
        targets[i, [sources.index[c] for c in item[2]]] = 1
    photo_head = train_head(data["photo"][train], targets[train], len(sources.classes), multi_label=True, epochs=40)
    patch_train = ~test[data["patch_owner"]]
    patch_head = train_head(data["patch"][patch_train], data["patch_label"][patch_train], len(sources.classes) + 1, multi_label=False, epochs=20)
    report = evaluate(sources, data, photo_head, patch_head, use)
    print(json.dumps(report, indent=1))
    export(sources, data, photo_head, patch_head, report, use)
    print(json.dumps({k: report[k] for k in ["weights", "quantized"]}, indent=1))
