/**
 * Node adapter: T106 PDF path → extracted fields.
 * Uses pdf-parse for the PDF → text step, then hands off to the shared extractor.
 */
import { readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import { decodeT106Text, extractT106Fields, T106_FIELDS } from './extract.js';

export { T106_FIELDS };

/**
 * @param {string} pdfPath
 * @returns {Promise<{ fields: Object<number, number>, rawText: string, decodedText: string }>}
 */
export async function parseT106(pdfPath) {
  const buffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const { text: rawText } = await parser.getText();
  const decodedText = decodeT106Text(rawText);
  const fields = extractT106Fields(decodedText);
  return { fields, rawText, decodedText };
}
