# Tax Form Assistant — Chrome MV3 extension

Draggable in-page panel that fills Form 1301 from **T106** salary certificates and **Form 867** broker certificates. Upload multiple files, review a combined summary (including the §92 securities loss-offset proposal), edit any value, then fill the form.

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
4. **Upload one or more PDFs** — T106 salary certificates and/or Form 867 broker certificates. Each file's type is auto-detected and added to the list (remove with ×). Pass **single-broker** 867s (not a combined/merged PDF).
5. Optionally enter **external donations** (added into `txt037`) and **prior-year carry-forward losses**.
6. Review the **securities summary** — the §92 loss-offset proposal (net gain, net interest/dividend, carry-forward) computed from all 867s per Tax Authority circular 10/2025. The offset order is your choice; **edit any value** in the fill table before filling.
7. Click **Fill form**. Fields not on the current page (e.g. the נספח ג / Appendix C tab) are reported as missing — switch tabs and fill again.

### How it parses 867s in the browser

`pdf-parse`'s `getTable()` (the Node path) isn't available in-page, so the browser adapter (`parse-867.ts`) gets positioned text items from `pdfjs` and rebuilds the rate-column grid with the shared pure `lib/867/layout.js`. `test/867-browser-parity.test.mjs` proves this matches the Node `getTable` output for both broker layouts.

## Permissions today

`<all_urls>` host match for testing. Will be tightened to `https://secapp.taxes.gov.il/*` once the field IDs are confirmed against the live page.
