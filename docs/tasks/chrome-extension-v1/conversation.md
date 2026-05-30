# Conversation — chrome-extension-v1

## 2026-05-30 — initial scoping

**User intent.** Turn this Node CLI into a Chrome MV3 extension. v1 must:
- have a popup that can be dragged around the screen,
- support T106 PDF upload and fill the live Form 1301 page,
- show helpful errors (not on the form page; PDF parse failure),
- allow manual entry of T106 fields.
- be available on `<all_urls>` and `file://` for testing (will lock down later).

Future versions: IBKR CSV, 867 PDF, xlsx helper generation, downloads.

**Key clarification surfaced.** MV3 action popups are anchored to the toolbar and close on blur — they cannot be dragged. Decided to inject a draggable floating panel via a content script instead, and use the toolbar action as a toggle. Recorded in ADR-001.

**Decisions confirmed by user via AskUserQuestion:**

- Build tool: **Vite + `@crxjs/vite-plugin`**.
- Language: **TypeScript** for extension code (`extension/src/**/*.ts`). Shared `lib/t106/` and the existing CLI stay JS.
- CLI: **kept**, sharing core extractor with the extension via `lib/t106/extract.js`.

## Deferred

- IBKR CSV upload integration in the panel.
- 867 PDF parser.
- xlsx helper generation (replacing the Google Sheets path) + downloadable artifacts.
- Tightening manifest matches from `<all_urls>` down to the tax-authority domain once the field IDs are confirmed in production.
