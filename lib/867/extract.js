/**
 * Pure Form 867 extractor. Environment-agnostic.
 *
 * Form 867 is an Israeli broker's "tax withheld at source" certificate. A single
 * (non-combined) 867 has up to a few sub-pages; we care about two:
 *   - 867 א+ב — capital gain on securities (רווח הון מניירות ערך)
 *   - 867 ג   — dividend & interest on securities (דיבידנד וריבית מניירות ערך)
 * See `867_to_1301_mapping.md` for what each field means and where it lands on Form 1301.
 *
 * Input model (produced by an adapter such as `parse-node.js`):
 *   {
 *     pages: [{ num, rows: [{ cells: string[], raw: string }] }],
 *     text:  string   // full plain text (for meta + the loss-offset checkbox)
 *   }
 * Each row's `cells` are the table cells in visual (left-to-right) order with the Hebrew
 * label last; `raw` is the row as a single string. The two adapters differ in how they build
 * rows (ruled-grid detection vs. text-line splitting) but converge on this shape, so the
 * extraction logic below is identical for every broker.
 *
 * Rate columns are read dynamically from each table's own header row — orderings and counts
 * differ between tables (gains [35,25,20,15,0], dividend [23,25,20,15,4,0], interest
 * [35,23,25,20,15,10,0]) — so we never hardcode a column index.
 */

/** Human-readable catalog of the fields this extractor returns. */
export const FIELDS_867 = {
  "capitalGains.taxableGainByRate":
    "רווח חייב במס לפני קיזוז הפסדים, לפי שיעור מס (867 א+ב)",
  "capitalGains.lossesAvailable": "הפסדים ברי קיזוז (מוחלט)",
  "capitalGains.totalSales": "מחזור מכירות כולל (שדה 256)",
  "capitalGains.transactions": "מספר עסקאות",
  "capitalGains.taxWithheld": "מס שנוכה במקור על רווח הון (שדה 040)",
  "capitalGains.lossesOffsetAgainstInterestDividend":
    "האם קוזזו הפסדים כנגד ריבית/דיבידנד (checkbox)",
  "dividend.incomeByRate":
    "הכנסה מדיבידנד לפני קיזוז, לפי שיעור (867 ג שורה 1)",
  "dividend.foreignByRate": 'מתוכה דיבידנד מחו"ל (867 ג שורה 2)',
  "dividend.taxWithheld": "מס שנוכה במקור מדיבידנד (867 ג שורה 6)",
  "interest.incomeByRate":
    "הכנסה מריבית/דמי ניכיון לפני קיזוז, לפי שיעור (867 ג שורה 7)",
  "interest.foreignByRate": 'מתוכה ריבית מחו"ל (867 ג שורה 8)',
  "interest.refundForLossOffset": "החזר בגין קיזוז הפסדי הון",
  "interest.taxWithheld": "מס שנוכה במקור מריבית (867 ג שורה 11)",
}

/** Parse a cell that is *purely* a number (commas, decimals, leading minus). Else null. */
function toNumber(cell) {
  if (cell == null) return null
  const s = String(cell).trim()
  if (!/^-?\d[\d,]*(\.\d+)?$/.test(s)) return null
  const n = Number(s.replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

/** Tax-rate percentages declared in a row, in left-to-right order, e.g. [35,25,20,15,0]. */
export function headerRates(row) {
  return [...row.raw.matchAll(/(\d+)\s*%/g)].map((m) => Number(m[1]))
}

/** A row is a rate header when it declares two or more "NN%" columns. */
function isRateHeader(row) {
  return headerRates(row).length >= 2
}

/**
 * Read a rate-keyed row: scan the page top-down tracking the most recent rate header, and when
 * `labelRe` matches a data row, zip that header's rates with the row's value cells by index.
 * Returns `{ [rate]: number }` (0 for blank columns) or null if not found.
 */
function rateRow(page, labelRe) {
  let rates = null
  for (const row of page.rows) {
    if (isRateHeader(row)) {
      rates = headerRates(row)
      continue
    }
    if (rates && labelRe.test(row.raw)) {
      const valueCells = row.cells.slice(0, -1) // drop the trailing Hebrew label
      const byRate = {}
      rates.forEach((rate, i) => {
        byRate[rate] = toNumber(valueCells[i]) ?? 0
      })
      return byRate
    }
  }
  return null
}

/**
 * Read a single-value row: the first row whose `raw` matches `labelRe`, returning its first
 * purely-numeric cell (0 if the row exists but holds no number, null if no such row).
 */
function scalarRow(page, labelRe) {
  for (const row of page.rows) {
    if (!labelRe.test(row.raw)) continue
    for (const cell of row.cells) {
      const n = toNumber(cell)
      if (n != null) return n
    }
    return 0
  }
  return null
}

/** Concatenated raw text of a page. */
function pageText(page) {
  return page.rows.map((r) => r.raw).join("\n")
}

function classifyPage(page) {
  const t = pageText(page)
  // Match on data-row labels, not titles — a Psagot cover letter lists "דיבידנד וריבית"
  // and would otherwise masquerade as the 867 ג page.
  if (/מחזור מכירות/.test(t)) return "capgains"
  if (/הכנסה מדיבידנד/.test(t) || /שיעור ניכוי המס במקור/.test(t))
    return "divint"
  return "other"
}

function extractMeta(text) {
  const taxYear =
    text.match(/לשנת המס\s+(\d{4})/)?.[1] ??
    text.match(/(\d{4})\s+לשנת המס/)?.[1] ??
    null
  const withholdingFileNumber =
    text.match(/תיק ניכויים[\s\S]{0,80}?(\d{9})/)?.[1] ?? null

  let broker = null
  if (withholdingFileNumber) {
    const line = text.split("\n").find((l) => l.includes(withholdingFileNumber))
    if (line) {
      broker =
        line
          .replace(withholdingFileNumber, "")
          .replace(/מספר תיק ניכויים|שם/g, "")
          .trim() || null
    }
  }

  const accountNumber =
    text.match(
      /כי (?:שילמתי|ניכיתי) (?:לחשבון|מחשבון)[\s\S]{0,140}?(\d{3,})/
    )?.[1] ?? null
  const holderId = text.match(/פרטי השותפים[\s\S]{0,160}?(\d{9})/)?.[1] ?? null

  return {
    taxYear: taxYear ? Number(taxYear) : null,
    broker,
    withholdingFileNumber,
    accountNumber,
    holderId,
  }
}

/**
 * Detect the "were losses offset against interest/dividend income?" checkbox.
 * Low confidence by design: the marker glyph is broker-dependent (IBI prints a trailing " v",
 * Psagot prints "]x[" / "][") and sits on one of two near-identical lines. Callers should
 * surface this as "detected — confirm", never trust it silently.
 * @returns {true|false|null}
 */
function detectLossOffsetFlag(text) {
  const lines = text.split("\n")
  const hasMark = (l) => /[xX✓☑☒]/.test(l) || /(^|[\s\]])[vV]([\s[]|$)/.test(l)
  const posLine = lines.find(
    (l) =>
      /קיימים הפסדי הון/.test(l) && /מריבית/.test(l) && !/לא קיימים/.test(l)
  )
  const negLine = lines.find((l) => /לא קיימים/.test(l) && /מריבית/.test(l))
  if (posLine && hasMark(posLine)) return true
  if (negLine && hasMark(negLine)) return false
  return null
}

/**
 * Extract structured raw fields from a single 867.
 * @param {{ pages: Array, text: string }} input
 * @returns {object} structured fields plus `_warnings: string[]`
 */
export function extract867Fields({ pages, text }) {
  const warnings = []
  const capPages = pages.filter((p) => classifyPage(p) === "capgains")
  const capPage = capPages[0]
  const divPage = pages.find((p) => classifyPage(p) === "divint")

  if (!capPage) warnings.push("Capital-gains page (867 א+ב) not found.")
  if (!divPage) warnings.push("Dividend/interest page (867 ג) not found.")

  // Guard against a combined/merged multi-broker PDF — this extractor reads a single broker
  // and would otherwise silently drop the others. Detect via: more than one capital-gains page,
  // more than one distinct withholding-file number (תיק ניכויים), or fewer extractable pages
  // than the page markers declare (scanned/image pages — as in the merged 2025 file).
  const brokerNumbers = new Set(
    [...text.matchAll(/תיק ניכויים[\s\S]{0,80}?(\d{9})/g)].map((m) => m[1])
  )
  const declaredTotal = Math.max(
    0,
    ...[...text.matchAll(/-- \d+ of (\d+) --/g)].map((m) => Number(m[1]))
  )
  if (capPages.length > 1 || brokerNumbers.size > 1) {
    warnings.push(
      "This looks like a combined multi-broker 867 — pass a single broker's certificate. Only one broker was read."
    )
  }
  if (declaredTotal > pages.length) {
    warnings.push(
      `${declaredTotal - pages.length} page(s) had no extractable text (likely scanned/image pages). If this is a merged PDF, split it and pass each broker's 867 separately.`
    )
  }

  const lossesRaw = capPage ? scalarRow(capPage, /המיטיב/) : null
  const lossOffsetFlag = detectLossOffsetFlag(text)
  if (lossOffsetFlag === null) {
    warnings.push(
      "Could not detect the losses-offset-against-interest/dividend checkbox — confirm manually."
    )
  }

  const capitalGains = {
    taxableGainByRate: capPage
      ? rateRow(capPage, /רווחים חייבים במס למעט/)
      : null,
    lossesAvailable: lossesRaw == null ? null : Math.abs(lossesRaw),
    lossesReported: lossesRaw,
    totalSales: capPage ? scalarRow(capPage, /מחזור מכירות/) : null,
    transactions: capPage ? scalarRow(capPage, /מספר עסקאות/) : null,
    taxWithheld: capPage ? scalarRow(capPage, /מס שנוכה במקור/) : null,
    lossesOffsetAgainstInterestDividend: lossOffsetFlag,
  }

  const dividend = {
    incomeByRate: divPage
      ? rateRow(divPage, /הכנסה מדיבידנד לפני קיזוז/)
      : null,
    foreignByRate: divPage ? rateRow(divPage, /מדיבידנד\s+בחו/) : null,
    taxWithheld: divPage ? scalarRow(divPage, /מס שנוכה במקור מדיבידנד/) : null,
  }

  const interest = {
    incomeByRate: divPage
      ? rateRow(divPage, /הכנסה מריבית[\s\S]*?לפני קיזוז/)
      : null,
    foreignByRate: divPage ? rateRow(divPage, /מריבית\s+בחו/) : null,
    refundForLossOffset: divPage ? scalarRow(divPage, /החזר בגין קיזוז/) : null,
    taxWithheld: divPage ? scalarRow(divPage, /מס שנוכה במקור מריבית/) : null,
  }

  return {
    meta: extractMeta(text),
    capitalGains,
    dividend,
    interest,
    _warnings: warnings,
  }
}
