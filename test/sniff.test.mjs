/**
 * PDF type-sniffer tests (`node --test`). Exercises the real `sniffPdfType` (used by the
 * extension's `detectPdfType`) against all three real files, so a T106 can never be misrouted to
 * the 867 parser — both forms are "אישור ניכוי מס במקור" certificates, so order/specificity matter.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { URL } from "node:url"
import { sniffPdfType } from "../lib/867/sniff.js"

const pdfjs = await import(
  new URL("../extension/node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url).href
)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../extension/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).href

async function pdfText(path) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(path)) }).promise
  let s = ""
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    for (const it of tc.items) if ("str" in it) s += it.str + " "
  }
  return s
}

const cases = [
  ["data/Evinced_T106_2025.pdf", "T106"],
  ["data/867_2024_ibi.pdf", "867"],
  ["data/Psagot-867-2025.pdf", "867"],
]

for (const [path, expected] of cases) {
  test(`sniffPdfType(${path}) === ${expected}`, async () => {
    assert.equal(sniffPdfType(await pdfText(path)), expected)
  })
}

test("sniffPdfType unit cases", () => {
  assert.equal(sniffPdfType("… טופס 106 … אישור על ניכוי מס במקור מהשכר …"), "T106")
  assert.equal(sniffPdfType("אישור ניכוי מס במקור רווח הון מניירות ערך 867 א"), "867")
  assert.equal(sniffPdfType("some unrelated document"), "unknown")
})
