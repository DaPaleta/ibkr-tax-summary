/**
 * Section-92 waterfall tests (`node --test`), validated against the two worked examples in
 * 867_to_1301_mapping.md. 2024 is driven by the real IBI extraction; 2025 combines a literal
 * IBI-2025 (its standalone PDF is image-only) with the real Psagot extraction.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { parse867 } from "../lib/867/parse-node.js"
import { aggregate867, computeWaterfall } from "../lib/867/waterfall.js"
import { net867ToMainForm, net867ToAppendixC } from "../lib/867/mapping.js"

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.5, `${a} ≈ ${b}`)

test("2024 IBI — losses exceed gains, offset spills into interest/dividend", async () => {
  const { fields } = await parse867("data/867_2024_ibi.pdf")
  const w = computeWaterfall(aggregate867([fields]))

  // Gain 5,686 @25% fully offset by current losses → net 0.
  near(w.netGainByRate[25], 0)
  near(w.gainCurrentOffsetByRate[25], 5686)
  // Remaining losses offset interest 3,673 @15% and dividend 341 @25%; 9 @0% left alone.
  near(w.interestOffsetByRate[15], 3673)
  near(w.dividendOffsetByRate[25], 341)
  near(w.netInterestByRate[15], 0)
  near(w.netDividendByRate[25], 0)
  // 10,378 − 5,686 − 3,673 − 341 = 678 carried forward.
  near(w.carryForwardLoss, 678)
  near(w.totalSales, 93969)
  assert.equal(w.portfolioCount, 1)
})

test("2025 IBI+Psagot — gains exceed losses, nothing offsets interest/dividend", async () => {
  // IBI 2025 standalone is image-only; use its known values (mapping-doc example) as a literal.
  const ibi2025 = {
    capitalGains: {
      taxableGainByRate: { 15: 1757 },
      lossesAvailable: 1094,
      totalSales: 112609,
      transactions: 8,
      taxWithheld: 99,
    },
    dividend: {
      incomeByRate: { 25: 9, 0: 4 },
      foreignByRate: {},
      taxWithheld: 2,
    },
    interest: {
      incomeByRate: { 15: 5943 },
      foreignByRate: {},
      taxWithheld: 891,
    },
  }
  const { fields: psagot } = await parse867("data/Psagot-867-2025.pdf")

  const combined = aggregate867([ibi2025, psagot])
  near(combined.totalSales, 132952) // 112,609 + 20,343
  near(combined.lossesAvailable, 1132.4) // 1,094 + 38.4

  const w = computeWaterfall(combined)
  // Gain 1,757 @15% partly offset by 1,132.4 losses → net ≈ 625.
  near(w.netGainByRate[15], 624.6)
  near(w.gainCurrentOffsetByRate[15], 1132.4)
  // No losses left → interest 6,604 @15% and dividend 9 @25% fully taxable; nothing carried.
  near(w.netInterestByRate[15], 6604.15) // 5,943 + 661.15
  near(w.netDividendByRate[25], 9)
  near(w.carryForwardLoss, 0)
  assert.equal(w.portfolioCount, 2)
})

test("fill-map helpers map net values to confirmed 1301 ids", () => {
  const w = computeWaterfall(
    aggregate867([
      {
        capitalGains: {
          taxableGainByRate: { 15: 1757 },
          lossesAvailable: 1132,
          totalSales: 132952,
        },
        dividend: {
          incomeByRate: { 25: 9 },
          foreignByRate: {},
          taxWithheld: 0,
        },
        interest: {
          incomeByRate: { 15: 6604 },
          foreignByRate: {},
          taxWithheld: 0,
        },
      },
      {
        capitalGains: {
          taxableGainByRate: {},
          lossesAvailable: 0,
          totalSales: 0,
        },
        dividend: {},
        interest: {},
      },
    ])
  )
  const main = net867ToMainForm(w)
  assert.equal(main.txt256, 132952)
  assert.equal(main.txt054, 2)
  assert.equal(main.txt060, 6604) // net interest+dividend @15%
  assert.equal(main.txt141, 9) // net dividend @25%
  assert.ok(!("txt157" in main)) // no net interest @25% → omitted

  const ac = net867ToAppendixC(w)
  assert.equal(ac.txtRhC12, 1757) // gross gain @15%
  assert.equal(ac.txtRhC32, 1132) // current-year loss offset @15%
  assert.equal(ac.txtRhC56, 132952)
})

test("carried-forward losses offset gains only, never interest/dividend (§4.1)", () => {
  const combined = aggregate867([
    {
      capitalGains: {
        taxableGainByRate: { 25: 100 },
        lossesAvailable: 0,
        totalSales: 0,
      },
      dividend: {
        incomeByRate: { 15: 500 },
        foreignByRate: {},
        taxWithheld: 0,
      },
      interest: { incomeByRate: {}, foreignByRate: {}, taxWithheld: 0 },
    },
  ])
  const w = computeWaterfall(combined, { carriedForwardLosses: 1000 })
  // 1,000 carried offsets the 100 gain; the 900 remainder may NOT touch the 500 dividend.
  near(w.gainCarriedOffsetByRate[25], 100)
  near(w.netGainByRate[25], 0)
  near(w.netDividendByRate[15], 500) // untouched
  near(w.carryForwardLoss, 900)
})
