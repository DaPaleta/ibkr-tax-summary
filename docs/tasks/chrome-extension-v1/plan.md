# Task: chrome-extension-v1

The authoritative plan for this task lives at `/Users/danielgoren/.claude/plans/ticklish-coalescing-liskov.md` (Claude Code plan file, approved by the user on 2026-05-30). This file mirrors the key points so they survive locally with the repo.

## Goal

Turn the existing Node CLI into a Chrome MV3 extension that fills the live Form 1301 page from a T106 PDF, with a draggable in-page panel and manual override per field.

## Scope (v1)

- MV3 extension, `<all_urls>` + `file://` (for testing).
- Draggable floating panel injected by a content script (NOT the action popup — MV3 popups can't be dragged).
- T106 PDF upload → in-browser parse via `pdfjs-dist` → fill `#txtNNN` inputs on the active page.
- Editable field table for manual override / manual-only entry.
- Friendly errors: wrong page, hard PDF failure, all-zero soft failure.

## Out of scope (later versions)

- IBKR CSV upload, 867 PDF parsing, xlsx helper generation, downloads.

## Key architectural decisions

1. In-page panel via content script (action popup is not draggable).
2. Refactor `src/parse-t106.js` so the pure decode/extract logic lives in `lib/t106/extract.js` and is shared by the Node CLI and the browser content script.
3. Build tool: Vite + `@crxjs/vite-plugin`. Language for extension code: TypeScript. Shared `lib/` stays JS.
4. CLI is kept working so we can A/B parity-check the browser parser against the Node parser.
5. `pdfjs-dist` worker shipped as a `web_accessible_resource`.

## Implementation order

1. Docs scaffold (this folder, vision, structure, ADR-001).
2. Refactor T106 extraction into `lib/t106/`. Verify CLI parity.
3. Scaffold `extension/` (Vite + crxjs + TS, minimal MV3 manifest).
4. Draggable panel shell (drag, mount/unmount, persisted position).
5. `form-filler.ts` — probe + fill + dispatch input/change events.
6. `parse-browser.ts` — pdfjs-dist + shared extract.
7. Field table UI + manual override + external donations.
8. Error banners.
9. Manual verification (see plan file for the 7-step checklist).

## Risk / open items

- The real `secapp.taxes.gov.il` page may use slightly different IDs or framework-specific input handling — confirm against the live page during verification.
- `file://` access requires the user to toggle "Allow access to file URLs" per-extension; documented in README.
- pdfjs worker loading inside an MV3 service-worker context has quirks; the parser runs in the content script (not the SW), which sidesteps most of them.

## Acceptance

All 7 verification steps in the plan file pass on `data/Evinced_T106_2025.pdf` and a saved copy of `form1301.html`.
