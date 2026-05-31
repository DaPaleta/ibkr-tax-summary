/**
 * Extractor tests for Form 867, run with `node --test`.
 * Validates both extraction paths against the two real standalone samples:
 *   - data/867_2024_ibi.pdf       — IBI, ruled-grid (getTable) path
 *   - data/Psagot-867-2025.pdf    — Psagot, text-line path
 * Expected values are the worked examples in 867_to_1301_mapping.md.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { parse867 } from "../lib/867/parse-node.js"

test("IBI 2024 — ruled-grid (getTable) path", async () => {
  const { fields, source } = await parse867("data/867_2024_ibi.pdf")
  assert.equal(source, "table")

  assert.equal(fields.meta.taxYear, 2024)
  assert.equal(fields.meta.withholdingFileNumber, "930474655")
  assert.equal(fields.meta.accountNumber, "120047")

  const cg = fields.capitalGains
  assert.equal(cg.taxableGainByRate[25], 5686)
  assert.equal(cg.lossesAvailable, 10378)
  assert.equal(cg.lossesReported, 10378)
  assert.equal(cg.totalSales, 93969)
  assert.equal(cg.transactions, 16)
  assert.equal(cg.taxWithheld, 0)
  assert.equal(cg.lossesOffsetAgainstInterestDividend, true)

  assert.equal(fields.dividend.incomeByRate[25], 341)
  assert.equal(fields.dividend.incomeByRate[0], 9)
  assert.equal(fields.dividend.foreignByRate[25], 59)
  assert.equal(fields.dividend.taxWithheld, 85)

  assert.equal(fields.interest.incomeByRate[15], 3673)
  assert.equal(fields.interest.refundForLossOffset, 636)
  assert.equal(fields.interest.taxWithheld, 551)
})

test("Psagot 2025 — text-line path", async () => {
  const { fields, source } = await parse867("data/Psagot-867-2025.pdf")
  assert.equal(source, "text")

  assert.equal(fields.meta.taxYear, 2025)
  assert.equal(fields.meta.withholdingFileNumber, "935807727")
  assert.equal(fields.meta.accountNumber, "208884")

  const cg = fields.capitalGains
  assert.equal(cg.lossesAvailable, 38.4) // normalized from reported -38.40
  assert.equal(cg.lossesReported, -38.4)
  assert.equal(cg.totalSales, 20343)
  assert.equal(cg.transactions, 1)
  assert.ok(Object.values(cg.taxableGainByRate).every((v) => v === 0))

  assert.ok(Object.values(fields.dividend.incomeByRate).every((v) => v === 0))
  assert.equal(fields.dividend.taxWithheld, 0)

  assert.equal(fields.interest.incomeByRate[15], 661.15)
  assert.equal(fields.interest.taxWithheld, 93.41)
})

test("combined multi-broker PDF is flagged, not silently half-read", async () => {
  const { fields } = await parse867("data/867_2025_combined.pdf")
  // The merged file has image-only IBI pages; only one broker is extractable. The extractor
  // must warn rather than present a confident, half-correct result.
  assert.ok(
    fields._warnings.some((w) =>
      /merged|combined|no extractable text/i.test(w)
    ),
    `expected a combined/merged-PDF warning, got: ${JSON.stringify(fields._warnings)}`
  )
})
