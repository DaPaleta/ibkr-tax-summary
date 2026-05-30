/**
 * Pure T106 text → fields extractor. Environment-agnostic.
 *
 * Font encoding quirks in T106 PDFs:
 *   - Digits are shifted by +1: glyph '0' renders as '1', ..., '8' as '9'.
 *     The glyph for zero is encoded as '/' (forward slash).
 *   - '[' is encoded as 'Z', ']' as '\\'.
 *   - Numbers use '+' as thousands separator (e.g. 444+431 = 444,431).
 *
 * Both adapters (`parse-node.js`, `parse-browser.js`) hand text into here.
 */

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
export function decodeT106Text(raw) {
  return raw.replace(/[Z\\/0-8]/g, (ch) => {
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

function parseNum(str) {
  return parseInt(str.replace(/\+/g, ''), 10) || 0;
}

function firstNum(str) {
  const m = str.match(/\b\d{1,3}(?:\+\d{3})*\b|\b\d+\b/);
  return m ? parseNum(m[0]) : 0;
}

function lastNum(str) {
  const matches = [...str.matchAll(/\b\d{1,3}(?:\+\d{3})*\b|\b\d+\b/g)];
  return matches.length ? parseNum(matches[matches.length - 1][0]) : 0;
}

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
 * Extract a single field from decoded T106 text using a field-specific strategy.
 * Strategies per field documented inline below.
 */
export function extractField(text, fieldNum) {
  switch (fieldNum) {
    case 158: {
      const bracket = findBracket(text, 158);
      if (!bracket) return 0;
      const before = text.slice(Math.max(0, bracket.index - 400), bracket.index);
      return lastNum(before.replace(/\[[^\]]*\]/g, ''));
    }

    case 42: {
      // The Hebrew letter נ is encoded as U+F8FF in some T106 fonts, so the word
      // "הכנסה" can appear as "הכסה". Match the corrupted form.
      const m = text.match(/מס ה\S+\t([\d+]{3,})/);
      if (m) return parseNum(m[1]);

      const bracket = findBracket(text, 42);
      if (!bracket) return 0;
      const before = text.slice(Math.max(0, bracket.index - 200), bracket.index);
      return lastNum(before.replace(/\[[^\]]*\]/g, ''));
    }

    case 45: {
      const pensionSection = text.match(/גמל לקצבה([\s\S]*?)(?=קרן השתלמות|$)/)?.[1] ?? '';
      const totalRow = pensionSection.match(/סה.כ:[^\n]+/)?.[0] ?? '';
      return firstNum(totalRow);
    }

    case 218: {
      // Anchor to the appendix heading to avoid the earlier "שווי קרן השתלמות" line.
      const studySection =
        text.match(/סוג קופה[:\s]+קרן השתלמות([\s\S]*?)(?=סוג קופה|$)/)?.[1] ?? '';
      const totalRow = studySection.match(/סה.כ:[^\n]+/)?.[0] ?? '';
      return lastNum(totalRow);
    }

    case 244: {
      const m = text.match(/שכר מבוטח ששילם המעסיק\s+([\d+]+)/);
      return m ? parseNum(m[1]) : 0;
    }

    case 248: {
      const bracket = findBracket(text, 248);
      if (!bracket) return 0;
      const before = text.slice(Math.max(0, bracket.index - 100), bracket.index);
      return lastNum(before.replace(/\[[^\]]*\]/g, ''));
    }

    case 11: {
      // Same line as [011, 012]: [011+ 012]\tלמחיר יום...\t9\t334 — take the last number.
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
 * Run all known T106 field extractors against decoded text.
 * @param {string} decodedText
 * @returns {Object<number, number>}
 */
export function extractT106Fields(decodedText) {
  const fields = {};
  for (const fieldNum of Object.keys(T106_FIELDS)) {
    fields[Number(fieldNum)] = extractField(decodedText, Number(fieldNum));
  }
  return fields;
}
