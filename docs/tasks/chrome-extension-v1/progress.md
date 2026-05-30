# Progress — chrome-extension-v1

## 2026-05-30

- Plan approved. Task folder, vision, structure, and ADR-001 created.
- Refactored `src/parse-t106.js` → `lib/t106/{extract,parse-node,mapping}.js`. `src/parse-t106.js` is now a thin re-export; `src/fill-1301-form.js` updated to import from `lib/t106/`.
- CLI parity verified on `data/Evinced_T106_2025.pdf`: all 8 fields extracted with the expected non-zero values (158=294,526, 244=282,136, 218=109,984, 42=75,514, 45=16,929, 248=41,839, 11=418, 37=0).
- Scaffolded `extension/` with Vite + `@crxjs/vite-plugin` + TypeScript. MV3 manifest in place with `<all_urls>` + `file://`-compatible setup. Action click toggles the panel via a service-worker → content-script message; no toolbar popup (would have prevented `onClicked` from firing).
- Implemented draggable in-page panel: `content.ts` (entry), `panel.ts` (UI state), `drag.ts` (header drag + position persisted to `chrome.storage.local`), `panel.css` (scoped under `#tax-assistant-panel`).
- Implemented `form-filler.ts` (probe `#txtNNN` IDs, set value via prototype setter for React-compat, dispatch `input`+`change`) and `parse-browser.ts` (pdfjs-dist + shared `decodeT106Text` / `extractT106Fields`).
- Field table UI with editable per-field inputs (yellow highlight on 0), external donations input, Fill / Clear buttons, persisted last values in `chrome.storage.local`.
- Error banners: wrong-page warn on mount when no expected IDs are present; red banner on hard PDF parse failure; yellow soft-failure banner when parse returns all zeros.
- Build verified: `cd extension && npm install && cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/vendor/ && npm run build` produces a clean `dist/` (manifest + service-worker + content-script bundle + panel.css + vendor/pdf.worker.min.mjs).
- Top-level `README.md` updated with a Chrome extension quick-start section linking to `extension/README.md`.

### Pending manual verification (requires Chrome)

1. Load `extension/dist` as an unpacked extension in `chrome://extensions`.
2. Open a saved copy of `form1301.html` via `file://` (with "Allow file access" enabled for the extension).
3. Click the toolbar icon → panel mounts → drag works → position persists across reload.
4. Upload `data/Evinced_T106_2025.pdf` → expect the same values as the CLI run above. Click Fill → all 8 fields populated; verify with devtools that `input`/`change` events fired.
5. On `https://example.com` → expect the wrong-page warning, Fill is a no-op.
6. Upload a non-PDF file → expect the red parse-failure banner.
7. Once accessible: confirm `#txt158` etc. match real IDs on `secapp.taxes.gov.il`; adjust `lib/t106/mapping.js` if not.
