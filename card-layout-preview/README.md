# Card layout preview

Small Vite app to preview **TemplateSpec** JSON exported from [figma-layer-inspector](../README.md) (or the same shape): a fixed-size card with absolutely positioned images and text.

## Run

```bash
cd card-layout-preview
npm install
npm run dev
```

Open the URL shown (default [http://localhost:5180](http://localhost:5180)). The sample loads automatically from `public/sample/template.json` with a local `photo.svg`.

## Load your data

1. **Sample (built-in)** — Click **Load sample** or refresh. Images use paths relative to the JSON file (served under `/sample/`).
2. **Open JSON** — Picks a single `.json` file. Image `default` values must be full `https://` URLs unless you also use folder mode (browsers do not expose a folder path for one file).
3. **Open folder** — Select a directory that contains your `template.json` (or any `.json`; `template.json` is preferred) and image files. Paths in JSON should be relative to that JSON file (e.g. `assets/photo.png`). Non-HTTP `default` strings are matched against files in the folder.

## JSON shape

`width` / `height` are the card size in points/pixels. `front.images[]` and `front.text[]` use `x`, `y`, `width`, `height` from the export. Each image has `default`: remote URL, or a relative path for local assets.

## Build

```bash
npm run build
npm run preview
```

