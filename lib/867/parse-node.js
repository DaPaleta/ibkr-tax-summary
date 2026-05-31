/**
 * Node adapter: Form 867 PDF path → normalized pages + text → extracted fields.
 *
 * Two extraction paths, chosen at runtime (see `867_to_1301_mapping.md` and the project memory
 * on 867 PDF quirks):
 *   - Brokers whose PDF has a ruled table grid (e.g. IBI): `getTable()` reconstructs the
 *     rate-column cells. Their `getText()` drops empty cells, so plain text loses columns.
 *   - Brokers without a detectable grid (e.g. Psagot): `getTable()` returns no tables, but
 *     `getText()` emits "0.00" per empty cell so each row stays column-aligned on one line.
 *
 * We try `getTable()` first; if it yields no rate-header rows we fall back to splitting the
 * plain text into per-page lines. Either way we hand the shared extractor the same
 * `{ pages: [{ num, rows: [{ cells, raw }] }], text }` model.
 */
import { readFile } from "fs/promises"
import { PDFParse } from "pdf-parse"
import { extract867Fields, FIELDS_867 } from "./extract.js"

export { FIELDS_867 }

/** Build the normalized page model from `getTable()` output (ruled-grid path). */
function pagesFromTables(tableResult) {
  return tableResult.pages.map((page) => ({
    num: page.num,
    rows: page.tables.flat().map((cells) => ({
      cells,
      raw: cells.join(" "),
    })),
  }))
}

/** Split one plain-text line into a row: leading numeric tokens, then the Hebrew label. */
function textLineToRow(line) {
  const tokens = line.trim().split(/\s+/)
  const values = []
  let i = 0
  for (; i < tokens.length; i++) {
    if (/^-?\d[\d,]*(\.\d+)?%?$/.test(tokens[i])) values.push(tokens[i])
    else break
  }
  const label = tokens.slice(i).join(" ")
  return { cells: [...values, label], raw: line.trim() }
}

/** Build the normalized page model from plain text, split on pdf-parse page markers. */
function pagesFromText(text) {
  return text
    .split(/-- \d+ of \d+ --/)
    .map((chunk) =>
      chunk
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    )
    .filter((lines) => lines.length > 0)
    .map((lines, idx) => ({
      num: idx + 1,
      rows: lines.map(textLineToRow),
    }))
}

function hasRateHeader(pages) {
  return pages.some((p) =>
    p.rows.some((r) => [...r.raw.matchAll(/(\d+)\s*%/g)].length >= 2)
  )
}

/**
 * @param {string} pdfPath path to a single (non-combined) 867 PDF
 * @returns {Promise<{ fields: object, pages: Array, text: string, source: "table"|"text" }>}
 */
export async function parse867(pdfPath) {
  const buffer = await readFile(pdfPath)

  const tableResult = await new PDFParse({ data: buffer }).getTable()
  const { text } = await new PDFParse({ data: buffer }).getText()

  if (!text || text.trim().length === 0) {
    throw new Error(
      `No text layer found in ${pdfPath}. The PDF is likely a scan/image — OCR is required (this happens with the combined/merged 867 file).`
    )
  }

  let pages = pagesFromTables(tableResult)
  let source = "table"
  if (!hasRateHeader(pages)) {
    pages = pagesFromText(text)
    source = "text"
  }

  const fields = extract867Fields({ pages, text })
  return { fields, pages, text, source }
}
