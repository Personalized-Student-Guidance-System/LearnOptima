/**
 * pdf-parse v2: use PDFParse + getText() (v1's default export is removed).
 */
const { PDFParse } = require('pdf-parse');

async function extractTextFromPdfBuffer(buffer) {
  if (!buffer || !buffer.length) return '';
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result && result.text) || '';
    return typeof text === 'string' ? text : '';
  } catch (e) {
    console.warn('[pdfText] getText failed:', e.message);
    return '';
  }
}

module.exports = { extractTextFromPdfBuffer };
