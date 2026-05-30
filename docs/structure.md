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
│   ├── upload-to-google-sheets.js  # CLI: upload summary to Google Sheets
│   └── utils/
│       └── google-auth-helper.js
├── lib/                            # Shared, environment-agnostic logic
│   └── t106/
│       ├── extract.js              # Pure: decodeT106Text + extractT106Fields
│       ├── mapping.js              # T106 field # → Form 1301 input ID
│       ├── parse-node.js           # Node adapter (pdf-parse + fs)
│       └── parse-browser.js        # Browser adapter (pdfjs-dist)
├── extension/                      # Chrome MV3 extension
│   ├── manifest.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── background.ts
│   │   ├── content/                # Injected on <all_urls>
│   │   │   ├── content.ts          # Mounts the panel
│   │   │   ├── panel.ts            # Panel UI state
│   │   │   ├── panel.css
│   │   │   ├── drag.ts             # Header-drag behavior
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
└── T106_to_1301_mapping.md         # Reference doc for the T106 → 1301 mapping
```

## Where each fact lives

- **Project vision and scope:** `docs/vision.md`
- **Repository layout (this map):** `docs/structure.md`
- **Active task design and progress:** `docs/tasks/<task-name>/`
- **Non-trivial technical decisions:** `docs/decisions/`
- **Tech stack, install, run commands:** `README.md`
- **Field-level T106 → 1301 mapping reference:** `T106_to_1301_mapping.md`
- **Shared T106 parsing logic:** `lib/t106/` (consumed by both CLI and extension)
