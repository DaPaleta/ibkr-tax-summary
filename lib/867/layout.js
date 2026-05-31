/**
 * Pure layout reconstruction for the browser 867 path. Environment-agnostic.
 *
 * The Node adapter (`parse-node.js`) gets column-aligned cells from `pdf-parse` `getTable()`. The
 * browser has only `pdfjs-dist` `getTextContent()`, which gives positioned text items but no grid.
 * This module rebuilds the same `{ pages, text }` model `extract867Fields` consumes, from items:
 *
 *   1. Cluster items into thin lines by y, then merge vertically-close lines into one logical row
 *      (a rate value often sits on a slightly different baseline than its Hebrew label — IBI).
 *   2. The first row with ≥2 "NN%" cells is a rate header; its `%` x-positions become column
 *      centers for the rows beneath it (until the next header).
 *   3. Each numeric cell in a data row is binned to the nearest column center, so values land in
 *      the right tax-rate column even when empty cells emit no text (IBI). Psagot already prints
 *      "0.00" per cell, so it round-trips unchanged.
 *
 * An item is `{ str, x, y, pageNum }` (x = left edge = transform[4], y = transform[5]).
 */

/** Two thin lines whose baselines are within this many units belong to one logical row. */
const ROW_MERGE_GAP = 11
/** Items within this y-distance form one thin line. */
const THIN_LINE_GAP = 2.5

const isPureNumber = (s) => /^-?\d[\d,]*(\.\d+)?$/.test(String(s).trim())
const hasPercent = (s) => /\d+\s*%/.test(String(s))

/** Group a page's items into logical rows of `{ cells, raw }`. */
function buildRows(items) {
  // 1. thin lines: top→bottom (descending y; works for IBI's negative and Psagot's positive y).
  const sorted = [...items].sort((a, b) => b.y - a.y)
  const thin = []
  for (const it of sorted) {
    const last = thin[thin.length - 1]
    if (last && Math.abs(last.y - it.y) <= THIN_LINE_GAP) last.items.push(it)
    else thin.push({ y: it.y, items: [it] })
  }

  // 2. merge vertically-close thin lines into logical rows (chain on the running baseline).
  const logical = []
  for (const line of thin) {
    const g = logical[logical.length - 1]
    if (g && Math.abs(g.lastY - line.y) <= ROW_MERGE_GAP) {
      g.items.push(...line.items)
      g.lastY = line.y
    } else {
      logical.push({ items: [...line.items], lastY: line.y })
    }
  }

  // 3. build cells, binning numeric values to the current rate header's column centers.
  let centers = null
  const rows = []
  for (const group of logical) {
    const its = [...group.items].sort((a, b) => a.x - b.x)
    const raw = its.map((i) => i.str).join(" ")
    const pct = its.filter((i) => hasPercent(i.str))

    if (pct.length >= 2) {
      centers = pct.map((i) => i.x).sort((a, b) => a - b)
      rows.push({ cells: its.map((i) => i.str), raw })
      continue
    }

    // Only numbers inside the rate-column x-band are values. Bare numbers far to the right are
    // the line's row number (e.g. the "1" in "…הפסדים 1") or footnote refs near the label —
    // getTable folds those into the label cell, so we exclude them here too.
    let band = null
    if (centers && centers.length >= 2) {
      const spacing =
        (centers[centers.length - 1] - centers[0]) / (centers.length - 1)
      band = [centers[0] - spacing, centers[centers.length - 1] + spacing]
    }
    const inBand = (i) => !band || (i.x >= band[0] && i.x <= band[1])
    const nums = its.filter((i) => isPureNumber(i.str) && inBand(i))
    const labelCell = its
      .filter((i) => !nums.includes(i))
      .map((i) => i.str)
      .join(" ")

    // Bin each value to its nearest rate column. A collision (two numbers → one column) means
    // this isn't a clean rate row — it's a scalar row whose value sits beside footnote/field-code
    // numbers (e.g. "מחזור מכירות … 93,969 … שדה 256 … קוד 56"). Fall back to value-then-label so
    // `scalarRow` reads the leftmost (real) number instead of a corrupted concatenation.
    let cells
    let collision = false
    if (centers && nums.length) {
      cells = Array(centers.length).fill("")
      for (const n of nums) {
        let best = 0
        let bestDist = Infinity
        centers.forEach((c, idx) => {
          const d = Math.abs(c - n.x)
          if (d < bestDist) {
            bestDist = d
            best = idx
          }
        })
        if (cells[best] !== "") collision = true
        else cells[best] = n.str
      }
      cells.push(labelCell)
    }
    if (!centers || !nums.length || collision) {
      cells = [...nums.sort((a, b) => a.x - b.x).map((i) => i.str), labelCell]
    }
    rows.push({ cells, raw })
  }
  return rows
}

/**
 * Build the `{ pages, text }` model from positioned pdfjs text items.
 * @param {Array<{ str: string, x: number, y: number, pageNum: number }>} items
 * @returns {{ pages: Array<{num:number, rows:Array}>, text: string }}
 */
export function itemsToModel(items) {
  const byPage = new Map()
  let total = 0
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue
    total = Math.max(total, it.pageNum)
    if (!byPage.has(it.pageNum)) byPage.set(it.pageNum, [])
    byPage.get(it.pageNum).push(it)
  }

  const pages = []
  const textParts = []
  for (const pn of [...byPage.keys()].sort((a, b) => a - b)) {
    const rows = buildRows(byPage.get(pn))
    pages.push({ num: pn, rows })
    textParts.push(rows.map((r) => r.raw).join("\n"))
    // Synthesize pd-parse-style page markers so the combined-PDF guard works in-browser too.
    textParts.push(`-- ${pn} of ${total} --`)
  }
  return { pages, text: textParts.join("\n") }
}
