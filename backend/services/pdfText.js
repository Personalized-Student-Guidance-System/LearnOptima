/**
 * pdf-parse v1: use default export function.
 */
const pdfParse = require('pdf-parse');

async function extractTextFromPdfBuffer(buffer) {
  if (!buffer || !buffer.length) return '';
  try {
    const data = await pdfParse(buffer);
    const text = (data && data.text) || '';
    return typeof text === 'string' ? text : '';
  } catch (e) {
    console.warn('[pdfText] getText failed:', e.message);
    return '';
  }
}

module.exports = { extractTextFromPdfBuffer };
