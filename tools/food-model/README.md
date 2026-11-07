# Photo food recogniser

Builds the model behind "Photo of a meal": `web/public/models/food-recognizer.onnx` and
`web/public/models/food-classes.json`. The app runs it on the phone with ONNX Runtime Web; photos
never leave the device.

## How it works

- **Backbone:** DINOv2 ViT-S/14 (Meta, Apache 2.0), a small vision network (22 M weights). It is
  used as it is: it turns a photo into numbers that describe it.
- **Two heads**, each a single layer, are the only part trained here:
  - the *photo head* gives, for each food, how likely the photo shows it; several foods can be on
    one plate, so every food from 30% up is listed;
  - the *patch head* says, for each of the 16 × 16 squares of the photo, which food it shows or
    none. How many squares a food covers, against how many it usually covers, scales its weight.
- **Weights** come from `classes.csv`: each recognisable food is one or more CREA foods with usual
  grams (a dish such as lasagne lists its ingredients). The app shows them for the user to check.

## Data, and why these sets

| Set | What | Licence |
| --- | --- | --- |
| MyFoodRepo / AIcrowd Food Recognition 2022 | 41,700 meal photos, 498 foods | CC BY 4.0 |
| Nutrition5k (Google) | 3,500 overhead plate photos with weighed ingredients | CC BY 4.0 |
| Open Images V7 (Google) | photos labelled by people as a food we know and as "Food" or "Dish" | labels CC BY 4.0, photos CC BY 2.0 |
| COCO 2017 | 10 foods, boxed; only photos under CC BY, no known restriction or US Government | annotations CC BY 4.0 |
| Wikimedia Commons | photos of Italian dishes (arancini, tiramisù, risotto…), found by category in `classes.csv`; the licence is checked photo by photo | CC BY, CC0, public domain and, by default, CC BY-SA |

Not used, because their terms forbid or do not allow reuse in an app: Food-101, UEC Food,
ISIA Food-500, Food2K, UNIMIB2016, VireoFood; nor non-commercial or no-derivatives photos.
ShareAlike photos are used: the model files are then shared under CC BY-SA 4.0 (`LICENSE.md`,
written next to the model), with each photo's author and licence in `ATTRIBUTION.csv`. To keep the
model under plain CC BY, fetch with `--no-share-alike`. All sets used
are credited in the app's Terms of Service.

## Rebuilding

Needs Python 3.12 with `torch torchvision transformers onnx onnxruntime pyarrow pillow numpy`, about
10 GB of disk and an hour on a laptop processor (no graphics card needed).

```sh
python3 tools/food-model/fetch_datasets.py ~/.cache/fit-os/food-model
python3 tools/food-model/fetch_commons.py ~/.cache/fit-os/food-model --list   # how many photos each class has
python3 tools/food-model/fetch_commons.py ~/.cache/fit-os/food-model          # downloads them (slow on purpose)
python3 tools/food-model/train.py ~/.cache/fit-os/food-model
```

Commons photos are asked for one request a second, as Wikimedia asks; downloading them takes a while. The
cached description of the photos (`features-<hash>.npz`) is named after the photos in it, so adding
photos describes everything again; delete old `features-*.npz` files to free the space.
`train.py` prints how often it is right on photos kept aside and stores the same numbers in
`food-classes.json` under `evaluation`. When the classes or their foods change, raise `version` in
`train.py` so phones fetch the new model instead of a cached one.
