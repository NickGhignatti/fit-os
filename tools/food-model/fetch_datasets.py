#!/usr/bin/env python3
"""Downloads the food photos the photo recogniser learns from.

Only sources whose licence allows reuse, with credit, are used; the app credits each of them:

- MyFoodRepo / AIcrowd Food Recognition Benchmark: meal photos from the MyFoodRepo app, 498 foods,
  CC BY 4.0 (Mohanty et al., "The Food Recognition Benchmark", Frontiers in Nutrition 2022).
  Read from the Hugging Face copy zhiyingzou0202/food_recognition_2022_processed.
- Nutrition5k (Google Research): overhead photos of cafeteria plates with each ingredient's weight,
  CC BY 4.0.
- Open Images V7 (Google): labels CC BY 4.0, photos listed as CC BY 2.0. Only photos whose
  human-verified labels include both a food we know and "Food" or "Dish" are taken.
- COCO 2017: annotations CC BY 4.0. Only photos whose own licence is CC BY, "no known copyright
  restrictions" or a US Government work are taken; the non-commercial and no-derivatives ones are not.

Left out on purpose: Food-101, UEC Food, ISIA Food-500, Food2K, UNIMIB2016, VireoFood (research use
only or no licence), and ShareAlike sets such as Fruits-360.

Usage: python3 tools/food-model/fetch_datasets.py ~/.cache/fit-os/food-model
"""
import concurrent.futures
import csv
import io
import json
import random
import sys
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
MFR_URL = "https://huggingface.co/datasets/zhiyingzou0202/food_recognition_2022_processed/resolve/main/data/"
MFR_FILES = [f"train-0000{i}-of-00004.parquet" for i in range(4)] + ["validation-00000-of-00001.parquet"]
N5K_URL = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/"
N5K_LIST = "https://storage.googleapis.com/storage/v1/b/nutrition5k_dataset/o?prefix=nutrition5k_dataset/imagery/realsense_overhead/&fields=items(name),nextPageToken&maxResults=1000"
OI_URL = "https://storage.googleapis.com/openimages/v7/"
OI_IMAGES = "https://open-images-dataset.s3.amazonaws.com/train/"
OI_FOOD = {"Food", "Dish"}
OI_PER_CLASS = 300
COCO_ANNOTATIONS = "http://images.cocodataset.org/annotations/annotations_trainval2017.zip"
COCO_IMAGES = "http://images.cocodataset.org/"
COCO_OPEN_LICENSES = {4, 7, 8}  # CC BY, no known copyright restrictions, US Government work


def download(url, path):
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    with urllib.request.urlopen(url, timeout=120) as response, open(tmp, "wb") as out:
        while chunk := response.read(1 << 20):
            out.write(chunk)
    tmp.rename(path)
    return path


def download_all(pairs):
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        for future in concurrent.futures.as_completed([pool.submit(download, url, path) for url, path in pairs]):
            try:
                future.result()
            except Exception as error:  # a few missing photos are fine
                print("skipped:", error)


def classes():
    return list(csv.DictReader(open(HERE / "classes.csv")))


def labels_of(column):
    """Maps each label of a dataset column in classes.csv to our class id."""
    return {label: c["id"] for c in classes() for label in filter(None, c[column].split("|"))}


def fetch_mfr(root):
    download_all([(MFR_URL + name, root / "mfr" / name) for name in MFR_FILES])


def fetch_n5k(root):
    for name in ["metadata/dish_metadata_cafe1.csv", "metadata/dish_metadata_cafe2.csv"]:
        download(N5K_URL + name, root / "n5k" / Path(name).name)
    dishes, token = [], None
    while True:
        page = json.load(urllib.request.urlopen(N5K_LIST + (f"&pageToken={token}" if token else "")))
        dishes += [o["name"].split("/")[-2] for o in page.get("items", []) if o["name"].endswith("/rgb.png")]
        if not (token := page.get("nextPageToken")):
            break
    download_all([(f"{N5K_URL}imagery/realsense_overhead/{d}/rgb.png", root / "n5k" / "rgb" / f"{d}.png") for d in dishes])


def fetch_open_images(root):
    folder = root / "oi"
    names = {}
    for mid, name in csv.reader(open(download(OI_URL + "oidv7-class-descriptions.csv", folder / "oidv7-class-descriptions.csv"))):
        names.setdefault(name, mid)
    wanted = {names[label]: cls for label, cls in labels_of("oi").items()}
    food = {names[n] for n in OI_FOOD}
    # The label file is 2.7 GB: read it as a stream and keep only what is needed.
    positives, has_food = defaultdict(set), set()
    with urllib.request.urlopen(OI_URL + "oidv7-train-annotations-human-imagelabels.csv", timeout=120) as response:
        for line in io.TextIOWrapper(response, encoding="utf-8"):
            image, _, mid, confidence = line.rstrip("\n").split(",")
            if confidence != "1":
                continue
            if mid in food:
                has_food.add(image)
            elif mid in wanted:
                positives[image].add(wanted[mid])
    by_class = defaultdict(list)
    for image in sorted(positives):
        if image in has_food:
            for cls in positives[image]:
                by_class[cls].append(image)
    random.seed(7)
    chosen = set()
    for cls, images in by_class.items():
        chosen.update(random.sample(images, min(OI_PER_CLASS, len(images))))
    with open(folder / "labels.csv", "w", newline="") as out:
        writer = csv.writer(out)
        for image in sorted(chosen):
            writer.writerow([image, "|".join(sorted(positives[image]))])
    download_all([(f"{OI_IMAGES}{image}.jpg", folder / "images" / f"{image}.jpg") for image in chosen])


def fetch_coco(root):
    folder = root / "coco"
    archive = zipfile.ZipFile(download(COCO_ANNOTATIONS, folder / "annotations_trainval2017.zip"))
    wanted = labels_of("coco")
    images, boxes = {}, defaultdict(list)
    for split in ["train2017", "val2017"]:
        data = json.loads(archive.read(f"annotations/instances_{split}.json"))
        categories = {c["id"]: wanted[c["name"]] for c in data["categories"] if c["name"] in wanted}
        for a in data["annotations"]:
            if a["category_id"] in categories and not a.get("iscrowd"):
                boxes[a["image_id"]].append([*a["bbox"], categories[a["category_id"]]])
        for i in data["images"]:
            if i["id"] in boxes and i["license"] in COCO_OPEN_LICENSES:
                images[i["id"]] = (split, i["file_name"], i["width"], i["height"])
    with open(folder / "boxes.json", "w") as out:
        json.dump([{"file": f, "width": w, "height": h, "boxes": boxes[i]} for i, (s, f, w, h) in sorted(images.items())], out)
    download_all([(f"{COCO_IMAGES}{s}/{f}", folder / "images" / f) for s, f, _, _ in images.values()])


if __name__ == "__main__":
    root = Path(sys.argv[1]).expanduser()
    for step in [fetch_mfr, fetch_n5k, fetch_open_images, fetch_coco]:
        print(step.__name__, flush=True)
        step(root)
