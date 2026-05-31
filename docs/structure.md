# Repository structure

```
.
├── README.md                       # Tech stack, commands, how to run the CLI
├── package.json
├── src/                            # Node CLI (existing)
│   ├── config.js
│   ├── fill-1301-form.js           # CLI: parse T106 + fill a local 1301 HTML copy
│   ├── parse-ibkr-trades.js        # CLI: IBKR CSV → ILS summary CSV
│   ├── parse-t106.js               # Node adapter — re-exports from lib/t106/
│   ├── parse-867.js                # CLI: extract a single 867 PDF → structured fields
│   ├── upload-to-google-sheets.js  # CLI: upload summary to Google Sheets
│   └── utils/
│       └── google-auth-helper.js
├── lib/                            # Shared, environment-agnostic logic
│   ├── t106/
│   │   ├── extract.js              # Pure: decodeT106Text + extractT106Fields
│   │   ├── mapping.js              # T106 field # → Form 1301 input ID
│   │   ├── parse-node.js           # Node adapter (pdf-parse + fs)
│   │   └── parse-browser.js        # Browser adapter (pdfjs-dist)
│   └── 867/
│       ├── extract.js              # Pure: extract867Fields over a normalized row model
│       ├── layout.js               # Pure: pdfjs positioned items → row model (browser path)
│       ├── waterfall.js            # Pure: aggregate867 + §92 loss-offset (computeWaterfall)
│       ├── mapping.js              # 867 fields → Appendix C / 1301 field codes + fill maps
│       └── parse-node.js           # Node adapter (pdf-parse getTable + getText)
├── test/                           # node --test suites
│   ├── 867.test.mjs                # 867 extractor tests (IBI + Psagot samples)
│   ├── 867-browser-parity.test.mjs # browser layout path == getTable path (legacy pdfjs)
│   └── waterfall.test.mjs          # §92 waterfall + fill-map tests
├── extension/                      # Chrome MV3 extension
│   ├── manifest.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── background.ts
│   │   ├── content/                # Injected on <all_urls>
│   │   │   ├── content.ts          # Mounts the panel
│   │   │   ├── panel.ts            # Panel UI: multi-file upload, §92 summary, fill
│   │   │   ├── panel.css
│   │   │   ├── drag.ts             # Header-drag behavior
│   │   │   ├── parse-browser.ts    # Browser T106 adapter (pdfjs → lib/t106)
│   │   │   ├── parse-867.ts        # Browser 867 adapter + PDF type sniffer (pdfjs → lib/867)
│   │   │   └── form-filler.ts      # Probes and fills #txtNNN inputs
│   │   └── popup/                  # Toolbar action popup (toggle)
│   │       ├── popup.html
│   │       └── popup.ts
│   └── public/
│       └── vendor/pdf.worker.min.js
├── data/                           # Local source documents (gitignored personal data)
├── output/                         # CLI outputs
├── docs/
│   ├── vision.md
│   ├── structure.md                # This file
│   ├── tasks/<task>/{plan,progress,conversation}.md
│   └── decisions/ADR-NNN-*.md
├── T106_to_1301_mapping.md         # Reference doc for the T106 → 1301 mapping
└── 867_to_1301_mapping.md          # Reference doc for the 867 → 1301 Appendix C (נספח ג) mapping
```

## Where each fact lives

- **Project vision and scope:** `docs/vision.md`
- **Repository layout (this map):** `docs/structure.md`
- **Active task design and progress:** `docs/tasks/<task-name>/`
- **Non-trivial technical decisions:** `docs/decisions/`
- **Tech stack, install, run commands:** `README.md`
- **Field-level T106 → 1301 mapping reference:** `T106_to_1301_mapping.md`
- **Form 867 → 1301 Appendix C calculation & mapping reference:** `867_to_1301_mapping.md`
- **Shared T106 parsing logic:** `lib/t106/` (consumed by both CLI and extension)
- **Shared 867 parsing logic:** `lib/867/` (Node adapter today; browser adapter later)
- **Automated tests:** `test/` (run with `npm test` → `node --test`)
