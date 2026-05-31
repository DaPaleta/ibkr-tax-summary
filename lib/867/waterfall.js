/**
 * Pure Section-92 loss-offset "waterfall" for Form 867 data. Environment-agnostic.
 *
 * Aggregates the raw fields from one or more single-broker 867s (see `extract.js`) and proposes
 * the net Appendix C (נספח ג) values, offsetting capital losses per Section 92 of the Income Tax
 * Ordinance as explained in Tax Authority circular 10/2025 (קיזוז הפסדי הון):
 *
 *   1. Capital losses offset real capital gains first. Carried-forward losses (from prior years)
 *      are spent here first — §4.1 says they may NOT offset interest/dividend — preserving the
 *      more-flexible current-year losses.
 *   2. Remaining CURRENT-year securities losses then offset interest & dividend income, but only
 *      where the tax rate is ≤25% (§3.3.2, "other securities"; the no-cap "same security" case of
 *      §3.3.1 can't be proven from aggregated 867 data, so the cap is applied generally).
 *   3. Anything still unused carries forward (no time limit, §4.x).
 *
 * The offset *order* is the taxpayer's choice (§6.1 — the ordering regulations are not enacted), so
 * this is a *proposal*: we default to the tax-optimal order (highest rate first) and the caller
 * (panel) lets the user review and edit before filling.
 *
 * Out of scope (surfaced as notes, not computed): the inflationary-amount 3.5:1 offset (§3.1 — 867
 * gains are already real ILS), and foreign-loss ordering (Greenfeld — 867 doesn't separate foreign
 * capital gains). This tool does not give tax advice.
 */

/** Interest/dividend rate buckets eligible for the §92(a)(4) offset (≤25%). */
export const INT_DIV_OFFSET_MAX_RATE = 25

/** Sum two `{ rate: amount }` maps into `target` (mutates and returns target). */
function addByRate(target, src) {
  if (!src) return target
  for (const [rate, amount] of Object.entries(src)) {
    target[rate] = (target[rate] ?? 0) + (amount ?? 0)
  }
  return target
}

function sumValues(byRate) {
  return Object.values(byRate ?? {}).reduce((a, b) => a + (b ?? 0), 0)
}

/**
 * Aggregate the raw fields of several single-broker 867s (the output of `extract867Fields`).
 * @param {Array<object>} extractedList
 * @returns {object} combined totals + a per-broker breakdown
 */
export function aggregate867(extractedList) {
  const combined = {
    taxableGainByRate: {},
    lossesAvailable: 0,
    totalSales: 0,
    transactions: 0,
    capGainsTaxWithheld: 0,
    dividendByRate: {},
    dividendForeignByRate: {},
    dividendTaxWithheld: 0,
    interestByRate: {},
    interestForeignByRate: {},
    interestTaxWithheld: 0,
    portfolioCount: extractedList.length,
  }

  for (const f of extractedList) {
    addByRate(combined.taxableGainByRate, f.capitalGains?.taxableGainByRate)
    combined.lossesAvailable += f.capitalGains?.lossesAvailable ?? 0
    combined.totalSales += f.capitalGains?.totalSales ?? 0
    combined.transactions += f.capitalGains?.transactions ?? 0
    combined.capGainsTaxWithheld += f.capitalGains?.taxWithheld ?? 0
    addByRate(combined.dividendByRate, f.dividend?.incomeByRate)
    addByRate(combined.dividendForeignByRate, f.dividend?.foreignByRate)
    combined.dividendTaxWithheld += f.dividend?.taxWithheld ?? 0
    addByRate(combined.interestByRate, f.interest?.incomeByRate)
    addByRate(combined.interestForeignByRate, f.interest?.foreignByRate)
    combined.interestTaxWithheld += f.interest?.taxWithheld ?? 0
  }

  return combined
}

/** Rates present in a map, sorted high→low (the default tax-optimal offset order). */
function ratesDescending(byRate) {
  return Object.keys(byRate)
    .map(Number)
    .filter((r) => byRate[r])
    .sort((a, b) => b - a)
}

/**
 * Run the §92 waterfall on aggregated 867 totals.
 * @param {object} combined output of `aggregate867`
 * @param {{ carriedForwardLosses?: number }} [opts] prior-year carried-forward losses (user input)
 * @returns {object} proposed net Appendix C values + the offsets applied, for review
 */
export function computeWaterfall(combined, opts = {}) {
  const notes = []
  let current = combined.lossesAvailable // current-year securities losses (positive magnitude)
  let carried = Math.max(0, opts.carriedForwardLosses ?? 0)

  // --- Step 1: offset capital gains (carried-forward first, then current) -----------------
  const netGainByRate = { ...combined.taxableGainByRate }
  const gainCarriedOffsetByRate = {}
  const gainCurrentOffsetByRate = {}

  for (const rate of ratesDescending(combined.taxableGainByRate)) {
    let gain = netGainByRate[rate]

    const fromCarried = Math.min(carried, gain)
    carried -= fromCarried
    gain -= fromCarried
    if (fromCarried) gainCarriedOffsetByRate[rate] = fromCarried

    const fromCurrent = Math.min(current, gain)
    current -= fromCurrent
    gain -= fromCurrent
    if (fromCurrent) gainCurrentOffsetByRate[rate] = fromCurrent

    netGainByRate[rate] = gain
  }

  // --- Step 2: remaining CURRENT losses offset interest/dividend at rates ≤25% ------------
  // Pool interest + dividend per rate but remember each so we can net them back separately.
  const netInterestByRate = { ...combined.interestByRate }
  const netDividendByRate = { ...combined.dividendByRate }
  const interestOffsetByRate = {}
  const dividendOffsetByRate = {}

  const eligibleRates = [
    ...new Set([
      ...Object.keys(combined.interestByRate),
      ...Object.keys(combined.dividendByRate),
    ]),
  ]
    .map(Number)
    // r > 0: offsetting losses against 0%-taxed income saves no tax, so it's never optimal
    // (matches the 2024 example, where the 9 @ 0% dividend is left un-offset).
    .filter((r) => r > 0 && r <= INT_DIV_OFFSET_MAX_RATE)
    .filter(
      (r) => (netInterestByRate[r] ?? 0) + (netDividendByRate[r] ?? 0) > 0
    )
    .sort((a, b) => b - a)

  for (const rate of eligibleRates) {
    // Offset interest before dividend within a rate (arbitrary; user can re-decide).
    const fromInterest = Math.min(current, netInterestByRate[rate] ?? 0)
    current -= fromInterest
    if (fromInterest) {
      interestOffsetByRate[rate] = fromInterest
      netInterestByRate[rate] -= fromInterest
    }
    const fromDividend = Math.min(current, netDividendByRate[rate] ?? 0)
    current -= fromDividend
    if (fromDividend) {
      dividendOffsetByRate[rate] = fromDividend
      netDividendByRate[rate] -= fromDividend
    }
  }

  // Income taxed above 25% can't absorb securities losses (§3.3.2).
  const aboveCap = [
    ...Object.keys(combined.interestByRate),
    ...Object.keys(combined.dividendByRate),
  ]
    .map(Number)
    .filter((r) => r > INT_DIV_OFFSET_MAX_RATE)
    .filter(
      (r) =>
        (combined.interestByRate[r] ?? 0) + (combined.dividendByRate[r] ?? 0) >
        0
    )
  if (aboveCap.length) {
    notes.push(
      `Interest/dividend taxed above 25% (rates: ${aboveCap.join(", ")}%) can't be offset by securities losses (§92(a)(4)/§3.3.2) and stays fully taxable.`
    )
  }

  // --- Step 3: carry forward what's left --------------------------------------------------
  const carryForwardLoss = current + carried

  if (
    sumValues(combined.dividendForeignByRate) ||
    sumValues(combined.interestForeignByRate)
  ) {
    notes.push(
      "Foreign-source interest/dividend present — foreign losses must offset foreign income first (Greenfeld); 867 data doesn't separate foreign capital gains, so verify foreign ordering manually."
    )
  }

  return {
    portfolioCount: combined.portfolioCount,
    totalSales: combined.totalSales,
    transactions: combined.transactions,

    taxableGainByRate: { ...combined.taxableGainByRate },
    gainCurrentOffsetByRate,
    gainCarriedOffsetByRate,
    netGainByRate,

    interestByRate: { ...combined.interestByRate },
    dividendByRate: { ...combined.dividendByRate },
    interestOffsetByRate,
    dividendOffsetByRate,
    netInterestByRate,
    netDividendByRate,

    lossesUsedAgainstGains:
      sumValues(gainCurrentOffsetByRate) + sumValues(gainCarriedOffsetByRate),
    lossesUsedAgainstIntDiv:
      sumValues(interestOffsetByRate) + sumValues(dividendOffsetByRate),
    carryForwardLoss,

    taxWithheld: {
      capitalGains: combined.capGainsTaxWithheld,
      dividend: combined.dividendTaxWithheld,
      interest: combined.interestTaxWithheld,
    },
    notes,
  }
}
