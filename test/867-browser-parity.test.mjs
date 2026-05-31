/**
 * Browser-path parity test (`node --test`).
 *
 * Proves the browser extraction (pdfjs positioned items → `itemsToModel` → `extract867Fields`)
 * yields the SAME known-correct fields as the Node `getTable` path. `867.test.mjs` already pins
 * the Node path to these same constants, so asserting the browser path against them proves the two
 * adapters agree — the point of the lib/ split — and exercises the x-binning column reconstruction.
 *
 * Uses the exact legacy pdfjs build the extension bundles. (We don't import `pdf-parse` here: its
 * pdfjs v5 worker collides with the legacy v4 build in one process.)
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { URL } from "node:url"
import { itemsToModel } from "../lib/867/layout.js"
import { extract867Fields } from "../lib/867/extract.js"

const pdfjs = await import(
  new URL(
    "../extension/node_modules/pdfjs-dist/legacy/build/pdf.mjs",
    import.meta.url
  ).href
)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../extension/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).href

async function browserExtract(path) {
  const data = new Uint8Array(await readFile(path))
  const doc = await pdfjs.getDocument({ data }).promise
  const items = []
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn)
    const tc = await page.getTextContent()
    for (const it of tc.items) {
      if (!("str" in it)) continue
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        pageNum: pn,
      })
    }
  }
  return extract867Fields(itemsToModel(items))
}

test("browser path (IBI 2024) reproduces the getTable values", async () => {
  const f = await browserExtract("data/867_2024_ibi.pdf")
  assert.equal(f.meta.withholdingFileNumber, "930474655")
  assert.equal(f.meta.taxYear, 2024)
  assert.equal(f.capitalGains.taxableGainByRate[25], 5686)
  assert.equal(f.capitalGains.lossesAvailable, 10378)
  assert.equal(f.capitalGains.totalSales, 93969)
  assert.equal(f.capitalGains.transactions, 16)
  assert.equal(f.dividend.incomeByRate[25], 341)
  assert.equal(f.dividend.incomeByRate[0], 9)
  assert.equal(f.dividend.foreignByRate[25], 59)
  assert.equal(f.dividend.taxWithheld, 85)
  assert.equal(f.interest.incomeByRate[15], 3673)
  assert.equal(f.interest.taxWithheld, 551)
})

test("browser path (Psagot 2025) reproduces the getTable values", async () => {
  const f = await browserExtract("data/Psagot-867-2025.pdf")
  assert.equal(f.meta.withholdingFileNumber, "935807727")
  assert.equal(f.meta.taxYear, 2025)
  assert.equal(f.capitalGains.lossesAvailable, 38.4)
  assert.equal(f.capitalGains.totalSales, 20343)
  assert.equal(f.capitalGains.transactions, 1)
  assert.equal(f.interest.incomeByRate[15], 661.15)
  assert.equal(f.interest.taxWithheld, 93.41)
})
