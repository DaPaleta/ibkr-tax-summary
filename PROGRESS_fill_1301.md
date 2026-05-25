# Progress: T106 → Form 1301 Auto-Fill

## Goal
Parse a T106 PDF and fill the locally saved Form 1301 HTML with the extracted values + externally provided donations.

## Files Created
- `src/parse-t106.js` — PDF text extraction + per-field extraction logic
- `src/fill-1301-form.js` — CLI entry point, cheerio-based HTML filling + save
- `T106_to_1301_mapping.md` — field mapping reference doc
- New deps: `pdf-parse`, `cheerio`
- New npm script: `fill-1301`

## CLI Usage
```bash
node src/fill-1301-form.js \
  --t106 ./data/T106_2024.pdf \
  --html ./data/form1301.html \
  --output ./output/form1301_filled.html \
  --donations 650
```

## Field Extraction Status

| Field | Description | Expected | Current Result | Status |
|-------|-------------|----------|----------------|--------|
| 158   | משכורת (salary) | 444,431 | 444,431 | ✅ |
| 244   | שכר מבוטח (insured salary) | 413,500 | 413,500 | ✅ |
| 248   | הפקדות המעסיק לקצבה | 61,333 | 61,333 | ✅ |
| 45    | קופת גמל עמית שכיר | 24,810 | 24,810 | ✅ |
| 11    | הפחתת דמי הבראה | 334 | 334 | ✅ |
| 37    | תרומות (T106 portion) | 0 | 0 | ✅ |
| 42    | מס הכנסה (income tax) | 103,468 | 103,468 | ✅ |
| 218   | ברוטו לקרן השתלמות | 188,544 | 188,544 | ✅ |

## Known Bugs — RESOLVED

### Field 42 (income tax) — FIXED
- Root cause: the PDF font encodes the Hebrew letter נ (nun) as U+F8FF (Apple PUA character),
  so "הכנסה" appears as "הכ\uf8ffסה" in the text stream. The JS source literal "מס הכסה"
  never matched because U+F8FF ≠ any visible space or letter.
- Fix: regex `/מס ה\S+\t([\d+]{3,})/` — matches "מס ה" + any non-whitespace (the corrupted word) + tab + digits.

### Field 218 (study fund gross) — FIXED
- Root cause: regex `/קרן השתלמות.../` matched "שווי קרן השתלמות" in the form body (earlier occurrence)
  instead of the appendix heading.
- Fix: anchored to `סוג קופה[:\s]+קרן השתלמות` which only appears in the appendix.

## PDF Encoding Notes
T106 PDFs use a shifted font encoding:
- `/ 0 1 2 3 4 5 6 7 8` decode to `0 1 2 3 4 5 6 7 8 9`
- `Z` → `[`, `\` → `]`
- `+` is used as thousands separator in numbers (e.g. `444+431` = 444,431)
- `+` is also used inside brackets as number separator (e.g. `[172+ 158]`)
- Hebrew text is unaffected (Unicode)
- Values often appear BEFORE their bracket label in the text stream (RTL layout artifact)
- `9` characters scattered through the text are visual separators, not numeric values

## Test Command
```bash
node src/fill-1301-form.js \
  --t106 "/Users/danielgoren/Desktop/Evinced_T106.pdf" \
  --html "/Users/danielgoren/Desktop/רשות המיסים - שידור דו___ח מס הכנסה ליחיד טופס 1301.html" \
  --output /tmp/form1301_filled.html \
  --donations 650
```
