# Tax Form Assistant — Chrome MV3 extension

Draggable in-page panel that fills Form 1301 from a T106 PDF.

## Develop

```bash
cd extension
npm install          # also copies the pdfjs worker into public/vendor/
npm run dev          # Vite dev server with HMR
# or
npm run build        # produces dist/
```

`dev` and `build` copy the pdfjs worker into `public/vendor/` before invoking Vite.

## Load in Chrome

1. `npm run build` (or `npm run dev` and use the `dist/` it writes).
2. Visit `chrome://extensions`, toggle **Developer mode**, click **Load unpacked**, pick `extension/dist`.
3. For testing on `file://` URLs (e.g. a local copy of `form1301.html`): on the extension's card in `chrome://extensions`, click **Details** → enable **Allow access to file URLs**. Chrome cannot grant this via manifest; it must be toggled manually.

## Use

1. Open the Form 1301 page (or a local saved copy on `file://`).
2. Click the extension's toolbar icon — the panel appears on the right.
3. Drag the header to move it. Position persists across reloads.
4. Upload a T106 PDF or fill values manually in the field table.
5. Add external donations (optional — they're added into `txt037`).
6. Click **Fill form**. The panel reports per-field success or missing IDs.

## Permissions today

`<all_urls>` host match for testing. Will be tightened to `https://secapp.taxes.gov.il/*` once the field IDs are confirmed against the live page.
