/**
 * Pure PDF type sniffer: decide whether extracted text is a T106 salary certificate or a Form 867
 * broker certificate. Environment-agnostic (takes already-extracted text).
 *
 * Order matters: a T106 (Form 106) is itself an employer's "אישור ניכוי מס במקור" (tax-withheld)
 * certificate, so it shares that phrase with 867. We therefore test the distinctive T106 markers
 * FIRST, and require a *securities* term for 867 — never the shared withholding phrase alone.
 *
 * @param {string} text
 * @returns {"T106" | "867" | "unknown"}
 */
export function sniffPdfType(text) {
  const t = String(text)
  if (/טופס\s*106/.test(t) || /ריכוז\s*שכר/.test(t) || /משכורת/.test(t)) {
    return "T106"
  }
  if (
    /רווח הון מניירות ערך/.test(t) ||
    /דיבידנד\s+וריבית/.test(t) ||
    /867\s*א/.test(t) ||
    /\b867\b/.test(t)
  ) {
    return "867"
  }
  return "unknown"
}
