/**
 * Browser adapter: Form 867 PDF File → extracted fields, plus a T106-vs-867 type sniffer.
 *
 * pdf-parse's getTable() (the Node 867 path) isn't available in the browser, so we get positioned
 * text items from pdfjs and rebuild the column grid with the shared, pure `itemsToModel`
 * (lib/867/layout.js) — proven to match the Node getTable output by test/867-browser-parity.
 */
import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { itemsToModel } from '../../../lib/867/layout.js';
import { extract867Fields } from '../../../lib/867/extract.js';
import { sniffPdfType } from '../../../lib/867/sniff.js';

pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.mjs');

export type PdfType = 'T106' | '867' | 'unknown';

export type Extracted867 = ReturnType<typeof extract867Fields>;

type PositionedItem = { str: string; x: number; y: number; pageNum: number };

async function loadDoc(file: File) {
  const buf = await file.arrayBuffer();
  return pdfjs.getDocument({ data: buf }).promise;
}

/** Concatenate all text on a page in reading order (for type sniffing / meta). */
async function fullText(file: File): Promise<string> {
  const doc = await loadDoc(file);
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    for (const item of tc.items) {
      if ('str' in item) parts.push((item as TextItem).str);
    }
    parts.push('\n');
  }
  return parts.join(' ');
}

/** Decide whether an uploaded PDF is a Form 867 broker certificate or a T106 salary certificate. */
export async function detectPdfType(file: File): Promise<PdfType> {
  return sniffPdfType(await fullText(file)) as PdfType;
}

/** Parse a single (non-combined) 867 PDF into structured raw fields. */
export async function parse867File(file: File): Promise<Extracted867> {
  const doc = await loadDoc(file);
  const items: PositionedItem[] = [];
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const tc = await (await doc.getPage(pn)).getTextContent();
    for (const item of tc.items) {
      if (!('str' in item)) continue;
      const ti = item as TextItem;
      items.push({ str: ti.str, x: ti.transform[4], y: ti.transform[5], pageNum: pn });
    }
  }
  return extract867Fields(itemsToModel(items));
}
