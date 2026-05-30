# ADR-001: Chrome MV3 extension architecture for the Form 1301 assistant

**Date:** 2026-05-30
**Status:** accepted

## Context

The project today is a Node CLI that parses a T106 PDF and writes values into a locally saved copy of the Form 1301 HTML. The user wants to evolve it into a browser-resident tool that sits alongside the live Tax Authority page while it is being filled by hand, so the local-HTML workaround can be retired.

The desired UX has three properties that constrain the architecture:

1. A panel that can be **dragged anywhere on the screen** while the user works.
2. **Available on any URL** for testing (including `file://`), to be locked down later.
3. Must reuse the T106 extraction logic that already works headlessly in Node, without forking it.

## Decision

Build a Chrome **Manifest V3** extension structured as follows:

1. **Draggable panel = content-script-injected DOM**, not the toolbar action popup. MV3 action popups are anchored to the toolbar and close on blur, so they cannot be dragged around the screen. The content script injects a `position: fixed` panel into the host page with a header drag handle; the toolbar action is a thin launcher that sends a "toggle" message to the content script.

2. **Single source of T106 parsing logic, two adapters.** The pure decode + field-extraction code in `src/parse-t106.js` is lifted into `lib/t106/extract.js` (environment-agnostic). Two thin adapters call it:
   - `lib/t106/parse-node.js` — uses `pdf-parse` + `fs`, consumed by the existing CLI.
   - `lib/t106/parse-browser.js` — uses `pdfjs-dist`, consumed by the extension content script.

3. **Vite + `@crxjs/vite-plugin`** for the extension build. Standard modern MV3 toolchain; gives HMR for the panel, MV3-aware manifest handling, and TypeScript out of the box.

4. **TypeScript for the extension; JavaScript for shared `lib/` and the CLI.** Extension has non-trivial message-passing between popup, background, and content scripts; types pay off there. The CLI is small, already working, and not worth churning.

5. **`<all_urls>` host match in v1; tighten later.** Easier testing on a `file://` copy of `form1301.html` while iterating. The user explicitly opted into this. `file://` further requires the user to enable "Allow access to file URLs" per-extension at `chrome://extensions` (Chrome does not let the manifest grant this).

6. **`pdfjs-dist` worker** shipped as a `web_accessible_resource` and pointed at via `chrome.runtime.getURL(...)` from the content script. PDF parsing runs in the content script (page world is fine), not in the service worker — sidesteps SW import-and-worker quirks.

## Alternatives considered

- **Toolbar action popup as the UI.** Rejected: not draggable, closes on blur, would not satisfy the "accompanies the user" requirement.
- **Detached side-panel (chrome.sidePanel API).** Available in MV3, but it's docked to the side of the window — also not draggable, and it does not give the same "floating over the form" affordance.
- **Plain esbuild script or raw ES modules without a build step.** Workable but adds boilerplate (manifest copy, worker copy, no HMR). Vite+crxjs is a clear ergonomic win for an extension we expect to iterate on.
- **Port the CLI to TS too.** Rejected: CLI is working; the refactor cost outweighs the type benefit for ~1k LOC of straightforward Node code.

## Consequences

**Positive**
- The same `extractT106Fields` function is exercised by both the CLI and the extension — parity testing is just "run both and diff".
- The UI is a normal piece of DOM the user can move/style/inspect, not constrained to the toolbar popup viewport.
- Testing path on `file://` keeps the loop tight while the live tax-page IDs are being confirmed.

**Negative / costs**
- A draggable in-page panel sits in the page's z-index and CSS world; we have to be defensive (use a high z-index, scope styles, avoid colliding with the host page's CSS — likely via a shadow root in a later iteration if needed).
- `file://` access requires a manual per-extension toggle the user has to remember.
- Two PDF parsing stacks (`pdf-parse` for Node, `pdfjs-dist` for the browser) must both be kept working until/unless we collapse on one.
- `<all_urls>` is more permission than we ultimately need; tightening it to the tax-authority domain is a follow-up before any non-developer install.
