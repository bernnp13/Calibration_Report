# Calibration Report Builder

A lightweight shareable web app based on the provided calibration report image.

## Features

- Fillable report header and service details
- Single report layout for `Whole Blood (WB)`
- Auto-calculated `Mean` and `CV%` rows from `WB #1` to `WB #10`
- PDF download and print-friendly layout
- Export and import report data as JSON
- Browser `localStorage` autosave

## Run

Open [index.html](/Users/bnp13/Documents/New project/index.html) directly in a browser, or serve the folder locally:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.
