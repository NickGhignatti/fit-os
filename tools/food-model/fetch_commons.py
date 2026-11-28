#!/usr/bin/env python3
"""Downloads photos of Italian dishes from Wikimedia Commons for the photo recogniser.

Each class of classes.csv names the Commons categories ("commons" column) that show it. Subcategories
are searched too, one level down, unless the name starts with "=": broad categories such as
"=Hamburgers" also hold restaurants, machines and other dishes, so only their own photos are taken. Every photo
carries its own licence, which is checked one by one: CC BY, CC0 and public domain are taken; with
ShareAlike on (the default) CC BY-SA too. Anything non-commercial, no-derivatives or unclear is left out.

Writes, under <root>/commons/:
- images/<hash>.jpg, the photos at 500 px wide;
- attribution.csv, one row per photo: file, classes, title, author, licence, licence link, page.
train.py reads both, and publishes the rows of the photos it learned from next to the model.

ShareAlike photos make the model a derivative that must be shared under the same licence: train.py
then writes CC BY-SA 4.0 for the model files. Without them (--no-share-alike) it is CC BY 4.0.

Usage: python3 tools/food-model/fetch_commons.py ~/.cache/fit-os/food-model [--no-share-alike] [--list]
  --list  counts the usable photos of each class without downloading them
  --only=pizza,risotto  works on those classes only
"""
import concurrent.futures
import csv
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
API = "https://commons.wikimedia.org/w/api.php"
# Wikimedia asks bots to say who they are and how to reach them.
AGENT = "fit-os-food-model/1.0 (https://github.com/nickghignatti/tracker; photo recogniser training set)"
PER_CLASS = 400
THUMB_WIDTH = 500  # one of the widths Commons keeps ready, so it is served from its cache
PAUSE = 1.0  # seconds between questions to the API
SUBCATEGORY_DEPTH = 1  # "Pizza margherita" keeps its photos in subcategories


def get(url, attempts=6):
    """The answer to [url], waiting and retrying while Commons asks to slow down."""
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 503) or attempt == attempts - 1:
                raise
            time.sleep(float(error.headers.get("Retry-After") or 5 * 2**attempt))
    raise RuntimeError(url)


def ask(**params):
    time.sleep(PAUSE)
    return json.loads(get(API + "?" + urllib.parse.urlencode({"format": "json", **params})))


def licence_ok(name, share_alike):
    """CC BY, CC0 and public domain; ShareAlike only when allowed; never NC or ND."""
    words = set(re.split(r"[\s\-]+", name.lower()))
    if words & {"nc", "nd"}:
        return False
    if "sa" in words:
        return share_alike and "cc" in words and "by" in words
    return ("cc" in words and "by" in words) or "cc0" in words or "public" in words or "pd" in words


def plain(text):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text or ""))).strip()


def photos_in(category, share_alike, depth=SUBCATEGORY_DEPTH):
    """The usable photos in a category and (to [depth] levels) its subcategories, as dicts."""
    found, token = [], {}
    while True:
        data = ask(action="query", generator="categorymembers", gcmtitle="Category:" + category, gcmtype="file", gcmlimit=50,
                   prop="imageinfo", iiprop="url|mime|extmetadata", iiurlwidth=THUMB_WIDTH,
                   iiextmetadatafilter="LicenseShortName|LicenseUrl|Artist", **token)
        for page in data.get("query", {}).get("pages", {}).values():
            info = (page.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            licence = plain(meta.get("LicenseShortName", {}).get("value"))
            if info.get("mime") == "image/jpeg" and info.get("thumburl") and licence_ok(licence, share_alike):
                found.append({
                    "title": page["title"].removeprefix("File:"),
                    "url": info["thumburl"],
                    "page": info["descriptionurl"],
                    "author": plain(meta.get("Artist", {}).get("value")),
                    "licence": licence,
                    "licence_url": plain(meta.get("LicenseUrl", {}).get("value")),
                })
        if "continue" not in data:
            break
        token = data["continue"]
    if depth > 0:
        data = ask(action="query", list="categorymembers", cmtitle="Category:" + category, cmtype="subcat", cmlimit=50)
        for sub in data.get("query", {}).get("categorymembers", []):
            found += photos_in(sub["title"].removeprefix("Category:"), share_alike, depth - 1)
    return found


def download(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        tmp.write_bytes(get(url))
        tmp.rename(path)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    share_alike = "--no-share-alike" not in sys.argv
    folder = Path(args[0]).expanduser() / "commons"
    only = next((a.removeprefix("--only=").split(",") for a in sys.argv if a.startswith("--only=")), None)
    classes = [c for c in csv.DictReader(open(HERE / "classes.csv")) if c.get("commons") and (only is None or c["id"] in only)]
    by_photo, classes_of = {}, defaultdict(set)
    for c in classes:
        usable = {}
        for category in filter(None, c["commons"].split("|")):
            only_own = category.startswith("=")
            for photo in photos_in(category.removeprefix("="), share_alike, 0 if only_own else SUBCATEGORY_DEPTH):
                usable[photo["page"]] = photo
        print(f"{c['id']:<20} {len(usable):>4} usable photos", flush=True)
        for page, photo in list(usable.items())[:PER_CLASS]:
            by_photo[page] = photo
            classes_of[page].add(c["id"])
    if "--list" in sys.argv:
        return
    rows = [(hashlib.md5(page.encode()).hexdigest()[:16], photo) for page, photo in sorted(by_photo.items())]
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        futures = {pool.submit(download, photo["url"], folder / "images" / f"{name}.jpg"): name for name, photo in rows}
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as error:  # a few missing photos are fine
                print("skipped:", futures[future], error)
    with open(folder / "attribution.csv", "w", newline="") as out:
        writer = csv.writer(out)
        writer.writerow(["file", "classes", "title", "author", "licence", "licence_url", "page"])
        for name, photo in rows:
            if (folder / "images" / f"{name}.jpg").exists():
                writer.writerow([f"{name}.jpg", "|".join(sorted(classes_of[photo["page"]])), photo["title"], photo["author"],
                                 photo["licence"], photo["licence_url"], photo["page"]])
    print(len(rows), "photos")


if __name__ == "__main__":
    main()
