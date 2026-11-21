# Photo food recogniser

`food-recognizer.onnx` and `food-classes.json` are licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

They were trained on the photos credited in the app's Terms of Service and, for the ones from Wikimedia
Commons, in `ATTRIBUTION.csv` (author, licence and page of each photo). The backbone is DINOv2 (Meta,
Apache License 2.0) and the heads were trained from `tools/food-model` in the repository.

You may share and adapt them, also commercially, if you credit the sources, link the licence, say what you
changed, and share your version under the same licence.
