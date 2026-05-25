/**
 * parse-t106.js
 *
 * Extracts field values from a T106 PDF (Form 106 — employer salary certificate).
 * Returns a plain object keyed by T106 field number (as integer).
 *
 * Font encoding quirks in T106 PDFs:
 *   - Digits are shifted by +1: glyph '0' renders as '1', ..., '8' as '9'.
 *     The glyph for zero is encoded as '/' (forward slash).
 *   - '[' is encoded as 'Z', ']' as '\'.
 *   - Numbers use '+' as thousands separator (e.g. 444+431 = 444,431).
 *   We decode all of this before parsing.
 *
 * Each field uses a targeted extraction strategy, because the PDF text ordering
 * (due to RTL layout + column structure) makes generic proximity search unreliable:
 *   - Some values appear BEFORE their bracket label in the text stream
 *   - Some values appear inline with a Hebrew label text
 *   - Two fields are most reliably taken from the appendix table (page 2)
 */

import { readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';

// T106 fields we care about, keyed by the primary field number.
export const T106_FIELDS = {
  158: 'משכורת (gross salary)',
  244: 'שכר מבוטח ששילם המעסיק (insured salary)',
  218: 'ברוטו לקרן השתלמות (study fund gross)',
  42: 'מס הכנסה (income tax withheld)',
  45: 'קופת גמל לקצבה - עמית שכיר (employee pension)',
  248: 'הפקדות המעסיק לקצבה (employer pension)',
  11: 'הפחתת דמי הבראה (recuperation deduction)',
  37: 'תרומות למוסדות ציבור (donations)',
};

/**
 * Decode the shifted font encoding used by T106 PDFs.
 * Only affects ASCII characters in the encoding range; Hebrew Unicode is unaffected.
 */
function decodeT106Text(raw) {
  return raw.replace(/[Z\\\\/0-8]/g, (ch) => {
    const map = {
      Z: '[',
      '\\': ']',
      '/': '0',
      '0': '1',
      '1': '2',
      '2': '3',
      '3': '4',
      '4': '5',
      '5': '6',
      '6': '7',
      '7': '8',
      '8': '9',
    };
    return map[ch] ?? ch;
  });
}

/** Parse a T106-formatted number string (strips '+' used as thousands separator). */
function parseNum(str) {
  return parseInt(str.replace(/\+/g, ''), 10) || 0;
}

/** Find the first T106 number in a string. */
function firstNum(str) {
  const m = str.match(/\b\d{1,3}(?:\+\d{3})*\b|\b\d+\b/);
  return m ? parseNum(m[0]) : 0;
}

/** Find the last T106 number in a string. */
function lastNum(str) {
  const matches = [...str.matchAll(/\b\d{1,3}(?:\+\d{3})*\b|\b\d+\b/g)];
  return matches.length ? parseNum(matches[matches.length - 1][0]) : 0;
}

/**
 * Find the first bracket in the decoded text that contains the given field number
 * as one of its components (handles zero-padding, e.g. [086+ 045] for field 45).
 */
function findBracket(text, fieldNum) {
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const parts = m[1]
      .split('+')
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !isNaN(n));
    if (parts.includes(fieldNum)) return m;
  }
  return null;
}

/**
 * Extract a field value from the decoded T106 text using a field-specific strategy.
 *
 * Strategies used per field (based on observed PDF text layout):
 *   158  — value appears alone just before bracket [172, 158]
 *   42   — value is inline with Hebrew label "מס הכסה"
 *   45   — first number in pension appendix "סה"כ" total row
 *   218  — last number in study fund appendix "סה"כ" total row
 *   244  — value is inline with Hebrew label "שכר מבוטח ששילם המעסיק"
 *   248  — value appears just before bracket [249, 248] (strip adjacent brackets first)
 *   11   — last 2+-digit number on same line as bracket [011, 012]
 *   37   — first number after bracket [237, 037]
 */
function extractField(text, fieldNum) {
  switch (fieldNum) {
    case 158: {
      // Value appears alone on its own line just before the bracket [172, 158].
      const bracket = findBracket(text, 158);
      if (!bracket) return 0;
      const before = text.slice(Math.max(0, bracket.index - 400), bracket.index);
      return lastNum(before.replace(/\[[^\]]*\]/g, ''));
    }

    case 42: {
      // Inline with Hebrew label "מס הכסה" (income tax withheld).
      // The PDF font encodes the Hebrew letter נ (nun) as U+F8FF (Apple PUA character),
      // so the word appears as "הכ\uf8ffסה" instead of "הכנסה".
      // Match "מס ה" + any non-whitespace chars (the corrupted word) + tab + digits.
      const m = text.match(/מס ה\S+\t([\d+]{3,})/);
      if (m) return parseNum(m[1]);

      // Fallback: value appears just before bracket [042]
      const bracket = findBracket(text, 42);
      if (!bracket) return 0;
      const before = text.slice(Math.max(0, bracket.index - 200), bracket.index);
      return lastNum(before.replace(/\[[^\]]*\]/g, ''));
    }

    case 45: {
      // First number in the pension (גמל לקצבה) appendix total row.
      // The appendix section ends when "קרן השתלמות" (study fund) section begins.
      const pensionSection = text.match(/גמל לקצבה([\s\S]*?)(?=קרן השתלמות|$)/)?.[1] ?? '';
      const totalRow = pensionSection.match(/סה.כ:[^\n]+/)?.[0] ?? '';
      return firstNum(totalRow);
    }

    case 218: {
      // Last number in the study fund (קרן השתלמות) appendix total row.
      // Anchor to "סוג קופה: קרן השתלמות" (appendix heading) to avoid matching
      // "שווי קרן השתלמות" which appears earlier in the form body.
      const studySection =
        text.match(/סוג קופה[:\s]+קרן השתלמות([\s\S]*?)(?=סוג קופה|$)/)?.[1] ?? '';
      const totalRow = studySection.match(/סה.כ:[^\n]+/)?.[0] ?? '';
      return lastNum(totalRow);
    }

    case 244: {
      // Inline with Hebrew label "שכר מבוטח ששילם המעסיק" (insured salary).
      const m = text.match(/שכר מבוטח ששילם המעסיק\s+([\d+]+)/);
      return m ? parseNum(m[1]) : 0;
    }

    case 248: {
      // Value appears just before bracket [249, 248].
      // Strip adjacent bracket [245, 244] to avoid picking up its field numbers.
      const bracket = findBracket(text, 248);
      if (!bracket) return 0;
      const before = text.slice(Math.max(0, bracket.index - 100), bracket.index);
      return lastNum(before.replace(/\[[^\]]*\]/g, ''));
    }

    case 11: {
      // On the same line as bracket [011, 012]: [011+ 012]\tלמחיר יום...\t9\t334
      // Take the last 2+-digit number on the line (the '9' before it is a separator, not the value).
      const bracket = findBracket(text, 11);
      if (!bracket) return 0;
      const lineEnd = text.indexOf('\n', bracket.index + bracket[0].length);
      const lineAfter = text.slice(
        bracket.index + bracket[0].length,
        lineEnd > 0 ? lineEnd : bracket.index + 300,
      );
      const nums = [...lineAfter.matchAll(/\b(\d{2,}(?:\+\d{3})*)\b/g)];
      return nums.length ? parseNum(nums[nums.length - 1][1]) : 0;
    }

    case 37: {
      // First number after bracket [237, 037]. Value is 0 if no employer-reported donations.
      const bracket = findBracket(text, 37);
      if (!bracket) return 0;
      const after = text.slice(
        bracket.index + bracket[0].length,
        bracket.index + bracket[0].length + 100,
      );
      return firstNum(after);
    }

    default:
      return 0;
  }
}

/**
 * Parse a T106 PDF and return extracted field values.
 *
 * @param {string} pdfPath - Path to the T106 PDF file
 * @returns {Promise<{ fields: Object<number, number>, rawText: string, decodedText: string }>}
 */
export async function parseT106(pdfPath) {
  const buffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const { text: rawText } = await parser.getText();
  const decodedText = decodeT106Text(rawText);

  const fields = {};
  for (const fieldNum of Object.keys(T106_FIELDS)) {
    fields[Number(fieldNum)] = extractField(decodedText, Number(fieldNum));
  }

  return { fields, rawText, decodedText };
}

// If running directly with node /path/to/script.js, print T106 mapping to console

