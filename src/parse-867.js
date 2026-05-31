/**
 * parse-867.js
 *
 * Extracts the fields needed for Form 1301 Appendix C (נספח ג) from a single (non-combined)
 * Form 867 broker certificate PDF, then prints them. The computed loss waterfall and form
 * filling are separate, later steps — this script only extracts the raw 867 values.
 *
 * Usage:
 *   node src/parse-867.js ./data/867_2024_ibi.pdf
 *   node src/parse-867.js ./data/Psagot-867-2025.pdf --json
 *
 * Note: pass a single broker's 867. A combined/merged multi-broker PDF (e.g. the IBI pages of
 * data/867_2025_combined.pdf, which are scanned images) is out of scope and may have no text layer.
 */
import { parseArgs } from "util"
import { parse867 } from "../lib/867/parse-node.js"

function parseCliArgs() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      pdf: { type: "string" },
      json: { type: "boolean", default: false },
    },
    strict: false,
  })
  const pdfPath = values.pdf ?? positionals[0]
  if (!pdfPath) {
    console.error("Error: pass a path to a single 867 PDF.")
    console.error("Usage: node src/parse-867.js <867.pdf> [--json]")
    process.exit(1)
  }
  return { pdfPath, json: Boolean(values.json) }
}

function fmtRates(byRate) {
  if (!byRate) return "(not found)"
  const nonZero = Object.entries(byRate).filter(([, v]) => v)
  if (nonZero.length === 0) return "0 (all rates)"
  return nonZero
    .map(([rate, v]) => `${v.toLocaleString()} @ ${rate}%`)
    .join(", ")
}

function fmtNum(n) {
  return n == null ? "(not found)" : n.toLocaleString()
}

function printSummary(fields, source) {
  const { meta, capitalGains: cg, dividend: d, interest: i } = fields

  console.log(`\nForm 867 — extracted fields  (source: ${source})\n`)
  console.log("Account")
  console.log(`  Tax year:            ${meta.taxYear ?? "(not found)"}`)
  console.log(`  Broker:              ${meta.broker ?? "(not found)"}`)
  console.log(
    `  Withholding file #:  ${meta.withholdingFileNumber ?? "(not found)"}`
  )
  console.log(`  Account #:           ${meta.accountNumber ?? "(not found)"}`)
  console.log(`  Holder ID:           ${meta.holderId ?? "(not found)"}`)

  console.log("\nCapital gain (867 א+ב)")
  console.log(`  Taxable gain:        ${fmtRates(cg.taxableGainByRate)}`)
  console.log(
    `  Losses available:    ${fmtNum(cg.lossesAvailable)}  (reported: ${fmtNum(cg.lossesReported)})`
  )
  console.log(`  Total sales (שדה256):${" "}${fmtNum(cg.totalSales)}`)
  console.log(`  Transactions:        ${fmtNum(cg.transactions)}`)
  console.log(`  Tax withheld:        ${fmtNum(cg.taxWithheld)}`)
  console.log(
    `  Losses vs int/div:   ${
      cg.lossesOffsetAgainstInterestDividend === null
        ? "⚠ undetected — confirm manually"
        : `${cg.lossesOffsetAgainstInterestDividend} (⚠ verify)`
    }`
  )

  console.log("\nDividend (867 ג)")
  console.log(`  Income:              ${fmtRates(d.incomeByRate)}`)
  console.log(`  Of which foreign:    ${fmtRates(d.foreignByRate)}`)
  console.log(`  Tax withheld:        ${fmtNum(d.taxWithheld)}`)

  console.log("\nInterest / discount (867 ג)")
  console.log(`  Income:              ${fmtRates(i.incomeByRate)}`)
  console.log(`  Of which foreign:    ${fmtRates(i.foreignByRate)}`)
  console.log(`  Refund (loss offset):${" "}${fmtNum(i.refundForLossOffset)}`)
  console.log(`  Tax withheld:        ${fmtNum(i.taxWithheld)}`)

  if (fields._warnings.length) {
    console.log("\nWarnings:")
    for (const w of fields._warnings) console.log(`  ⚠ ${w}`)
  }
  console.log()
}

async function main() {
  const { pdfPath, json } = parseCliArgs()
  const { fields, source } = await parse867(pdfPath)

  if (json) {
    console.log(JSON.stringify(fields, null, 2))
    return
  }
  printSummary(fields, source)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
