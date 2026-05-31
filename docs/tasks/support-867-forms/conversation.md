# Conversation — support-867-forms

## 2026-05-30

**User:** Added 2024 + 2025 867 PDFs, filled-form screenshots, and an Appendix C mhtml to `data/`.
Asked for a thorough read of the 867s vs. the filled tax forms and clear instructions for calculating
and filling the form, saved to an `.md`. Flagged that 2025 had **two** separate 867s combined into one
PDF and summarized for the filling.

**Decisions:**
- Deliverable is a reference doc, `867_to_1301_mapping.md`, placed at repo root beside
  `T106_to_1301_mapping.md` (same artifact category).
- Grounded the doc in the form's own labels + field codes, not tax-law interpretation.
- Framed loss application as a deterministic **waterfall** (gains → interest/dividend → carry-forward),
  explicitly distinct from the README's FX "Optimized P/L".
- Documented multi-broker combination (sum per rate/category, then run the waterfall once).

**Open / deferred:**
- The 2025 sample does not apply 2024's 678 carry-forward into §ג row 3 — documented as a likely
  oversight, not the method.
- No worked example exercises §ג row 3 (carried-forward) or the helper table's pre-2006 row 3; those
  are described from form labels only.
- The "which rate bucket to offset first" choice is undemonstrated and left unspecified.
- Field codes for unpopulated Appendix C cells come from screenshots, not the live form.

## 2026-05-30 — extractor step

**User:** "Write an extractor script, like we already have for T106. It expects a single (not
combined) 867 and extracts the required fields to fill the tax form later." Mid-task, the user
added `data/Psagot-867-2025.pdf` (the original, non-merged Psagot file) for text extraction.

**Decisions:**
- Extract **raw** 867 values (not the computed Appendix C waterfall) — filling is a later step.
- Mirror T106's four-file structure under `lib/867/` + `src/parse-867.js` + a `test/` suite.
- Dual extraction path (getTable for IBI, text for Psagot) behind a source-agnostic pure
  extractor; rates parsed dynamically from headers; losses normalized to positive magnitude.

**Deferred (at the time):**
- Splitting a **combined** multi-broker 867 into single-broker inputs (and OCR for the image-only
  IBI pages in the merged file). The extractor intentionally takes one broker's 867.
- Computing the loss waterfall and filling Appendix C / 1301 — *now done* (step 3).
- A browser adapter for `lib/867/` — *now done* (`lib/867/layout.js` + `parse-867.ts`).

## 2026-05-30 — extension integration (step 3)

**User:** Add 867 to the extension (upload + extract like T106); allow multiple files of both
types; summarize inputs before filling, "like the combined pdf". Then chose **auto-propose net
values** over gross-only, and supplied the **Section 92 directive** (חוזר 10/2025) to ground it.

**Decisions:**
- Implement the §92 waterfall as a *reviewable proposal* (default tax-optimal order; user edits) —
  reconciles "auto-propose" with vision's "not a tax advisor", since §6.1 makes the order the
  taxpayer's choice.
- Browser column reconstruction (x-binning, `lib/867/layout.js`) instead of porting pdf-parse's
  getTable; lock it to the Node path with a parity test.
- Type-sniff uploads (T106 vs 867) from PDF text; combine by summing T106 fields and running the
  867 waterfall on the pooled brokers.

**Deferred:**
- Confirming Appendix C HTML ids beyond the 15% cells (`txtRhC12/32/56`) — other-rate §ג rows are
  shown in the summary but only the confirmed ids are filled.
- Inflationary-amount (3.5:1) and foreign-loss ordering — surfaced as warnings, not computed.
- Tightening host permissions to `secapp.taxes.gov.il` once live field ids are confirmed.
