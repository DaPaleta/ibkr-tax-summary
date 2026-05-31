/**
 * Form 867 → Form 1301 Appendix C (נספח ג) field mapping.
 *
 * This maps the *raw* 867 fields to where they belong on Appendix C / the main 1301. The actual
 * net values (after the loss waterfall) are computed in a later step; this file is the lookup the
 * filler uses. See `867_to_1301_mapping.md` for the full explanation and worked examples.
 *
 * Two numbering systems are in play:
 *   - Appendix-C internal cell numbers (e.g. 12, 32, 56) → live-form HTML ids `txtRhC<NN>`.
 *   - Form 1301 `שדה` codes (e.g. 256, 060, 067, 055) → live-form HTML ids `txt<NNN>`.
 */

/** Total securities sales turnover (867 "שדה 256" → Appendix C field 56). */
export const TOTAL_SALES = {
  appendixField: 56,
  htmlId: "txtRhC56",
  field1301: "txt256",
}

/** Number of investment portfolios/accounts (one per broker 867). */
export const PORTFOLIO_COUNT = { field1301: "txt054" }

/**
 * Appendix C §ג (income from sale of securities) — cell numbers by tax rate.
 * Only the populated cells (15% rows 1 & 2) are confirmed against the live form's HTML ids;
 * the rest are read from the 2024/2025 Appendix C screenshots.
 */
export const GAINS_ROWS = {
  // Row 1: רווח חייב במס, לפני קיזוז הפסדים
  taxableGain: { 15: 12, 20: 10, 25: 13, 30: 48, 35: 44 },
  // Row 2: קיזוז הפסדי הון שוטפים מניירות ערך
  currentLossOffset: { 15: 32, 20: 30, 25: 33, 30: 49, 35: 36 },
  // Row 3: קיזוז הפסדי הון מועברים מניירות ערך (carried-forward losses)
  carriedLossOffset: { 15: 62, 20: 60, 25: 63, 30: 51, 35: 34 },
}

/**
 * Net interest/dividend income transfers to the main 1301 by tax rate (after the helper-table
 * offset). 25% has separate ids for dividend (txt141) vs interest (txt157).
 */
export const INTEREST_DIVIDEND_1301 = {
  15: { field1301: "txt060" },
  20: { field1301: "txt067" },
  25: { dividend: "txt141", interest: "txt157" },
  30: { field1301: "txt055" },
}

/** Carried-forward losses box (הפסדים להעברה) — value confirmed; field code unconfirmed. */
export const CARRY_FORWARD_LOSSES = { label: "הפסדים להעברה" }

const round = (n) => Math.round(n ?? 0)

/**
 * Map a `computeWaterfall` result to the **main Form 1301** input ids (net values, after offset).
 * These are the broker fields the user historically filled directly on 1301
 * (see T106_to_1301_mapping.md). Zero values are omitted.
 * @returns {Record<string, number>}
 */
export function net867ToMainForm(w) {
  const map = {}
  const net = (rate) =>
    (w.netInterestByRate?.[rate] ?? 0) + (w.netDividendByRate?.[rate] ?? 0)
  if (w.totalSales) map.txt256 = round(w.totalSales)
  if (w.portfolioCount) map.txt054 = w.portfolioCount
  if (net(15)) map.txt060 = round(net(15))
  if (net(20)) map.txt067 = round(net(20))
  if (w.netInterestByRate?.[25]) map.txt157 = round(w.netInterestByRate[25])
  if (w.netDividendByRate?.[25]) map.txt141 = round(w.netDividendByRate[25])
  if (net(30)) map.txt055 = round(net(30))
  return map
}

/**
 * Map a `computeWaterfall` result to the **Appendix C (נספח ג)** input ids. These live on a
 * different portal tab than the main 1301 fields. Only the 15% cells have confirmed HTML ids
 * (txtRhC12/32/56); other rates are documented in `867_to_1301_mapping.md` but not emitted here.
 * @returns {Record<string, number>}
 */
export function net867ToAppendixC(w) {
  const map = {}
  if (w.taxableGainByRate?.[15]) map.txtRhC12 = round(w.taxableGainByRate[15]) // row 1, gross
  const offset15 = w.gainCurrentOffsetByRate?.[15] ?? 0 // row 2, current-year loss offset
  if (offset15) map.txtRhC32 = round(offset15)
  if (w.totalSales) map.txtRhC56 = round(w.totalSales)
  return map
}
