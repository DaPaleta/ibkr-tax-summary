/**
 * fill-1301-form.js
 *
 * Fills a locally saved copy of the Israeli Tax Authority Form 1301 HTML
 * with values extracted from a T106 PDF, then saves the result.
 *
 * Usage:
 *   # Parse T106 only — print extracted fields to console:
 *   node src/fill-1301-form.js --t106 ./data/T106_2024.pdf
 *
 *   # Parse T106 and fill a 1301 HTML form:
 *   node src/fill-1301-form.js \
 *     --t106 ./data/T106_2024.pdf \
 *     --html ./data/form1301.html \
 *     --output ./output/form1301_filled.html \
 *     [--donations 650]
 *
 * Only the fields sourced from T106 (and donations) are filled.
 * Broker/investment fields are left for a future step.
 */

import { load } from "cheerio"
import { readFile, writeFile } from "fs/promises"
import { parseArgs } from "util"
import { parseT106, T106_FIELDS } from "./parse-t106.js"

// Maps T106 field numbers to their corresponding HTML input IDs.
// txt037 is a combined field: T106[037] + external donations.
const T106_TO_HTML = {
  158: "txt158", // משכורת (gross salary)
  244: "txt244", // שכר מבוטח ששילם המעסיק (insured salary for pension)
  218: "txt218", // ברוטו לקרן השתלמות (study fund gross salary)
  42: "txt042", // מס הכנסה (income tax withheld)
  45: "txt045", // קופת גמל לקצבה - עמית שכיר (employee pension contribution)
  248: "txt248", // הפקדות המעסיק לקצבה (employer pension contributions)
  11: "txt011", // הפחתת דמי הבראה (recuperation pay reduction)
  // Field 37 (donations) is handled separately below — it combines T106 + external amount
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      t106: { type: "string" },
      html: { type: "string" },
      output: { type: "string" },
      donations: { type: "string", default: "0" },
    },
    strict: false,
  })

  if (!values.t106) {
    console.error("Error: --t106 <path> is required")
    process.exit(1)
  }

  return {
    t106Path: values.t106,
    htmlPath: values.html,
    outputPath: values.output ?? values.html,
    externalDonations: parseInt(values.donations, 10) || 0,
  }
}

/**
 * Set the value attribute on an input element by its ID.
 * Logs a warning if the element is not found in the HTML.
 */
function fillField($, fieldId, value) {
  if (value === 0) return // leave empty fields untouched

  const el = $(`#${fieldId}`)
  if (el.length === 0) {
    console.warn(`  [warn] Field not found in HTML: #${fieldId}`)
    return
  }
  el.attr("value", String(value))
  console.log(`  ${fieldId} = ${value}`)
}

function printT106Fields(fields) {
  console.log("\nExtracted T106 fields:\n")
  for (const [num, value] of Object.entries(fields)) {
    const label = T106_FIELDS[num] ?? ""
    console.log(`  [${String(num).padStart(3, "0")}] ${label}:  ${value.toLocaleString()}`)
  }
  console.log()
}

async function main() {
  const { t106Path, htmlPath, outputPath, externalDonations } = parseCliArgs()

  // 1. Parse T106 PDF
  console.log(`\nParsing T106: ${t106Path}`)
  const { fields } = await parseT106(t106Path)

  // If no --html provided, just print the parsed T106 fields and exit
  if (!htmlPath) {
    printT106Fields(fields)
    return
  }

  console.log("Extracted fields:", fields)

  // 2. Load HTML
  const html = await readFile(htmlPath, "utf-8")
  const $ = load(html)

  // 3. Fill T106-sourced fields
  console.log("\nFilling fields:")
  for (const [fieldNum, htmlId] of Object.entries(T106_TO_HTML)) {
    fillField($, htmlId, fields[Number(fieldNum)])
  }

  // 4. Donations: T106[037] + external amount
  const donationsTotal = (fields[37] || 0) + externalDonations
  if (donationsTotal > 0) {
    fillField($, "txt037", donationsTotal)
  }

  // 5. Save
  await writeFile(outputPath, $.html(), "utf-8")
  console.log(`\nSaved filled form to: ${outputPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
