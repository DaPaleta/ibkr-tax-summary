# Task: support-867-forms

## Context

The toolkit already maps T106 (salary) → Form 1301. The next source document to support is
**Form 867** — the Israeli broker's tax-withheld certificate — which feeds **Appendix C (נספח ג)**
of Form 1301 (capital gains, dividends, interest on securities).

The user supplied reference data in `data/`:
- `867_2024_ibi.pdf` — single broker (IBI), tax year 2024.
- `867_2025_combined.pdf` — **two brokers** (IBI + Psagot) combined into one PDF, tax year 2025.
- `filled_867_in_appendix_C_2024.png`, `867_2025_filled.png` — the resulting filled Appendix C.
- `1301_867_appendix_webpage.mhtml` — the live Appendix C page (HTML field ids).

## Approach (this step)

Reverse-engineer the calculation + filling logic from the source 867s vs. the filled Appendix C,
and document it as a reference doc (`867_to_1301_mapping.md` at repo root, sibling to
`T106_to_1301_mapping.md`). No code in this step — the doc is the deliverable and the spec for
later parser/filler work.

## Scope

- IN: read 867 sub-forms (867א+ב, 867ג, 867 deposits), define the loss waterfall, the multi-broker
  combination rule, the Appendix C field map, and the transfer to main 1301.
- OUT (deferred): writing an 867 PDF parser, extending the extension/CLI to fill Appendix C.

## Acceptance criteria

- Reference doc explains: 867 anatomy, Appendix C field map, the loss waterfall, multi-broker
  combination, and two worked examples (2024 loss-heavy, 2025 gain-heavy) reconciled to the
  filled screenshots.

## Step 2 — extractor script (current)

Mirror the T106 four-file structure for Form 867. Input: a **single** (non-combined) 867 PDF.
Output: structured raw 867 fields (not the computed Appendix C waterfall — that comes later).

Files:
- `lib/867/extract.js` — pure: `extract867Fields({ pages, text })` over a normalized
  `{cells, raw}` row model.
- `lib/867/parse-node.js` — Node adapter: PDF → normalized pages + text → extractor.
- `lib/867/mapping.js` — rate → Appendix C / 1301 field codes.
- `src/parse-867.js` — CLI.

Key design decision (validated empirically on both broker samples):
- **IBI** PDFs: `pdf-parse` `getTable()` reconstructs the rate-column grid; its `getText()` drops
  empty cells (loses columns). → use `getTable()`.
- **Psagot** PDFs (standalone + combined): `getTable()` finds **0 tables**; `getText()` emits
  `0.00` per empty cell so rows are column-aligned. → use text-line parsing.
- Adapter tries `getTable()`; if no rate-header rows appear, falls back to text lines. The pure
  extractor is source-agnostic. Rate columns are parsed dynamically from each table header
  (orderings differ per table); column indices are never hardcoded. Losses normalized to a
  positive magnitude (IBI `10,378` vs Psagot `-38.40`).

Acceptance (step 2): `node src/parse-867.js data/867_2024_ibi.pdf` and `… data/Psagot-867-2025.pdf`
both extract the known values (gains/losses/sales/dividend/interest/withholding) matching the
mapping doc's worked examples.

## Risks / notes

- Field codes for unpopulated Appendix C cells are read from screenshots, not the live form.
- The 2025 sample does **not** apply 2024's 678 carry-forward loss — documented as a likely sample
  oversight, not the rule.
