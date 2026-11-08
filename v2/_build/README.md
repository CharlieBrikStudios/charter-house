# Charter House investment report, V2 draft

A single-scroll, light-theme rebuild of the Charter House investment report. It's a draft: the live report at the repo root (`/index.html` and `/andy/`) is untouched.

- `v2/index.html` is Charlie's version.
- `v2/andy/index.html` is Andy's version.
- `v2/assets/` holds web-optimised images (WebP) and self-hosted fonts (Bodoni Moda and Figtree, as in the BRIK shareholder report).

## Editing

Both pages are generated from `build.py`, with the styles in `styles.css` and the behaviour in `app.js`. To change copy or numbers, edit `build.py` and run:

```
python3 v2/_build/build.py
```

The returns figures are calculated in `build.py`, using the same model as the live report (the `EX` dictionary). Change the price, rent or rates there and every table and chart updates.
