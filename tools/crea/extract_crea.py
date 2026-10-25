#!/usr/bin/env python3
"""Builds the bundled food list from the CREA food composition tables.

Source: CREA Centro di ricerca Alimenti e Nutrizione, "Tabelle di composizione degli alimenti",
https://www.alimentinutrizione.it/sezioni/tabelle-nutrizionali. The tables are free to reuse
provided the source is cited (the app credits CREA wherever these foods are shown).

The site has no bulk download, so this reads the public food pages (allowed by robots.txt),
one request per second, and writes a CSV with the per-100 g values the app needs.

Usage: python3 tools/crea/extract_crea.py web/public/catalog/crea_foods.csv
"""
import csv
import html
import re
import sys
import time
import urllib.request

BASE = "https://www.alimentinutrizione.it"
LIST_URL = BASE + "/tabelle-nutrizionali/ricerca-per-alimento"
USER_AGENT = "TrackerApp-data-import/1.0 (personal nutrition app; cites CREA as source)"
DELAY_SECONDS = 1.0

NUTRIENTS = {
    "Energia (kcal)": "kcal",
    "Proteine (g)": "protein_g",
    "Lipidi (g)": "fat_g",
    "Carboidrati disponibili (g)": "carbs_g",
    "Zuccheri solubili (g)": "sugars_g",
    "Fibra totale (g)": "fiber_g",
    "Sodio (mg)": "sodium_mg",
}
FIELDS = ["code", "name", "name_en", "category", "portion_g", *NUTRIENTS.values()]


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def text(fragment):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", fragment))).strip()


def clean_name(name):
    """A few CREA names carry stray markup, e.g. '"|Caramelle tipo ""mou""|"'."""
    name = re.sub(r"\s+", " ", name.replace("|", "").replace('""', '"')).strip()
    if len(name) > 1 and name[0] == name[-1] == '"':
        name = name[1:-1].strip()
    return name


def number(value):
    """CREA writes "tr" for traces and leaves unknown values empty."""
    value = value.replace(",", ".").strip()
    if value in ("", "-"):
        return ""
    if value.lower() == "tr":
        return "0"
    match = re.match(r"^\d+(\.\d+)?", value)
    return match.group(0) if match else ""


def food_links(page):
    links = re.findall(r'<a href="/tabelle-nutrizionali/(\d+)"[^>]*>(.*?)</a>', page, flags=re.S)
    return list(dict((code, text(name)) for code, name in links).items())


def parse_food(code, name, page):
    food = {"code": code, "name": clean_name(name)}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S):
        cells = [text(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S)]
        if len(cells) < 2:
            continue
        label = cells[0]
        if label == "Categoria":
            food["category"] = cells[1]
        elif label == "English Name":
            food["name_en"] = cells[1]
        elif label == "Porzione":
            food["portion_g"] = number(cells[1].replace("g", ""))
        elif label in NUTRIENTS and len(cells) >= 3:
            food[NUTRIENTS[label]] = number(cells[2])
    return food


def main(output_path):
    foods = food_links(fetch(LIST_URL))
    print(f"{len(foods)} foods listed", file=sys.stderr)
    with open(output_path, "w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        for index, (code, name) in enumerate(foods, start=1):
            time.sleep(DELAY_SECONDS)
            try:
                food = parse_food(code, name, fetch(f"{BASE}/tabelle-nutrizionali/{code}"))
            except Exception as error:  # keep going; a missing food is reported, not fatal
                print(f"skipped {code} {name}: {error}", file=sys.stderr)
                continue
            if not food.get("kcal"):
                print(f"skipped {code} {name}: no energy value", file=sys.stderr)
                continue
            writer.writerow(food)
            if index % 50 == 0:
                print(f"{index}/{len(foods)}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
