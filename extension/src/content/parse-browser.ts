/**
 * Browser adapter: T106 PDF File → extracted fields.
 * Uses pdfjs-dist to get text content, then hands the joined text to the shared
 * `decodeT106Text` + `extractT106Fields` pure logic in lib/t106/extract.js.
 */
import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
// @ts-expect-error — JS module, imported as JS via tsconfig allowJs.
import { decodeT106Text, extractT106Fields } from '../../../lib/t106/extract.js';

pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.mjs');

export type ParseResult = {
  fields: Record<number, number>;
  decodedText: string;
};

/**
 * Join text items into a single string in a shape the field extractors expect:
 * tabs between items on the same visual line, newlines at line breaks.
 *
 * The extractors in `lib/t106/extract.js` lean on `\n` boundaries for fields
 * [011] (last number on the bracket's line) and [218] (last number in the
 * appendix total row). pdfjs's `getTextContent` exposes a `hasEOL` flag per
 * item — we use it to insert a newline at every line break, instead of one
 * newline per page.
 */
async function pdfToText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    for (const item of tc.items) {
      if (!('str' in item)) continue;
      const ti = item as TextItem;
      parts.push(ti.str);
      parts.push(ti.hasEOL ? '\n' : '\t');
    }
    parts.push('\n');
  }
  return parts.join('');
}

export async function parseT106File(file: File): Promise<ParseResult> {
  const rawText = await pdfToText(file);
  const decodedText = decodeT106Text(rawText);
  const fields = extractT106Fields(decodedText);
  return { fields, decodedText };
}
