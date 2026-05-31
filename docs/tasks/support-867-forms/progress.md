# Progress — support-867-forms

## 2026-05-30

- Read both 867 PDFs (2024 IBI; 2025 IBI+Psagot combined), both filled Appendix C screenshots, and
  the Appendix C mhtml.
- Reverse-engineered the loss waterfall and reconciled it to both filled forms:
  - 2024: losses 10,378 > gain 5,686 → offset gain (net 0), then interest 3,673 + dividend 341
    (net 0), carry-forward **678**. Cross-checked: broker refund 636 = 551 (interest tax) + 85
    (dividend tax). ✓
  - 2025: combined gain 1,757 > combined losses 1,132 → net gain 625 @ 15%, interest/dividend fully
    taxable (txt060=6,604, txt141/157=9), carry-forward 0. Total sales 132,952 = 112,609 + 20,343. ✓
  - Corrected a misread: IBI 2025 interest is **5,943** (5,943 + 661 = 6,604; net withholding ≈ 893).
- Confirmed field meanings against `T106_to_1301_mapping.md`: txt060/067/141/157/055, txt256, txt054.
- Wrote deliverable: `867_to_1301_mapping.md` (repo root).
- Updated `docs/structure.md` to list the new reference doc.

## 2026-05-30 (step 2 — extractor)

- Spiked extraction on the real PDFs and found a broker-dependent split:
  - **IBI** standalone (`867_2024_ibi.pdf`) has a text layer; `getTable()` reconstructs the
    rate-column grid; `getText()` drops empty cells (loses columns).
  - **Psagot** (standalone `Psagot-867-2025.pdf` + combined pages) returns **0 tables** from
    `getTable()`, but `getText()` emits `0.00` per empty cell → column-aligned rows.
  - The IBI pages *inside* the merged `867_2025_combined.pdf` are image-only (no text layer).
  - Corrected the project memory accordingly (was wrongly "IBI is image-only / needs OCR").
- Built the extractor mirroring T106's four-file layout:
  - `lib/867/extract.js` (pure), `lib/867/parse-node.js` (adapter, dual path), `lib/867/mapping.js`,
    `src/parse-867.js` (CLI), `test/867.test.mjs`.
  - Adapter tries `getTable()`; if no rate-header rows, falls back to text-line parsing. Pure
    extractor is source-agnostic over a `{cells, raw}` row model. Rates parsed dynamically from
    each header; losses normalized to positive magnitude (handles `-38.40`, decimals, commas).
- Fixed a classification bug: the Psagot **cover letter** page falsely matched "divint"
  (it lists "מדיבידנד וריבית"); switched to data-row anchors (`מחזור מכירות` / `הכנסה מדיבידנד`).
- Checkbox (losses offset vs interest/dividend) is detected but flagged low-confidence (⚠ verify).
- Validation: `npm test` → both samples pass; every field matches the mapping doc's worked
  examples. `npm run parse-867 <pdf>` prints a clean summary. eslint clean.
- Added `npm test` (`node --test`) and `npm run parse-867` scripts; updated `structure.md`,
  `README.md`.
- Added a combined-PDF guard: warns when >1 capital-gains page, >1 distinct תיק ניכויים, or fewer
  extractable pages than the markers declare (the merged 2025 file has image-only IBI pages, so it
  was silently reading only Psagot). Test covers it.
- **Test caveat:** the field-value assertions check the same two files the extractor was tuned on,
  so green tests prove *consistency/regression-safety*, not generalization to an unseen broker's
  layout. Only two real broker samples exist (IBI, Psagot).

## 2026-05-30 (step 3 — extension integration + §92 waterfall)

- User asked to add 867 to the Chrome extension: upload 867s like T106, allow multiple files of
  both types, and summarize inputs before filling. User chose **auto-propose net values** and
  supplied the Section 92 directive (חוזר 10/2025) to ground the offset logic.
- Read the directive (via pdf-parse — WebFetch couldn't). Encoded its rules in a pure module:
  - `lib/867/waterfall.js`: `aggregate867` (sum N single-broker 867s) + `computeWaterfall`
    (§92 order: carried-forward→gains only; current→gains then ≤25% interest/dividend; 0% never
    offset; remainder carries forward). Order is the taxpayer's choice (§6.1) → proposal, editable.
  - `lib/867/mapping.js`: `net867ToMainForm` / `net867ToAppendixC` → confirmed 1301 ids.
- Browser extraction (pdf-parse getTable is Node-only): `lib/867/layout.js` rebuilds the row model
  from pdfjs positioned items via thin-line merge + x-binning to rate-header centers. Two fixes
  found via the parity test: scalar rows with footnote numbers collided in a column (fall back to
  un-binned); the line's row-number sat far right and binned as a phantom value (x-band filter).
  `test/867-browser-parity.test.mjs` proves browser path == getTable values for both brokers.
- Extension: `parse-867.ts` (browser adapter + T106/867 type sniffer); `panel.ts` rewritten for
  multi-file upload, per-file list, editable §92 summary + fill plan, carry-forward input; CSS added.
- Verification: `npm test` 9/9 (extractor, parity, waterfall+mapping, combined-guard); `tsc --noEmit`
  clean; `vite build` ok; eslint/prettier clean. Updated mapping doc §4 (now §92-grounded),
  structure.md, both READMEs; recorded the directive as a reference memory.
- Post-review fix (advisor): `detectPdfType` checked the 867 phrase first, but a T106 is also an
  "אישור ניכוי מס במקור" certificate → could misroute. Extracted a pure `lib/867/sniff.js`
  (T106 markers first, 867 requires a *securities* term), tested against all 3 real files
  (`test/sniff.test.mjs`). Also: changing carry-forward now clears securities overrides so the
  proposal can't go stale. Tests now 13/13.

## 2026-05-31 (multi-tab awareness)

- User clarified the live 1301 spans tabs: T106 fields + 867 **summary lines** (net int/div,
  total sales, portfolio count) are on the **main tab**; the detailed §ג fields (`txtRhC*`) are on
  the **Appendix C (נספח ג)** tab. Inputs exist only for the open tab.
- Panel now tags each fill target with its tab (`tabOf`), labels groups by tab, detects the current
  tab (`detectCurrentTab`), and on Fill routes off-tab fields ("N field(s) belong to the נספח ג tab
  — switch there and Fill again"). Guides the user rather than auto-navigating. tsc + build clean.
- Recorded `form-1301-portal-tabs` memory; added a "Portal tabs" callout to the mapping doc.
