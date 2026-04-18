const axios = require('axios');

// Minimal Gemini wrapper (Google Generative Language API)
// Uses env var GEMINI_API_KEY (place in backend/.env)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro',
].filter(Boolean);

async function generateJson({ prompt, schemaHint = '', model = null, temperature = 0.2 }) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const fullPrompt = [
    schemaHint ? `Return ONLY valid JSON. ${schemaHint}` : 'Return ONLY valid JSON.',
    prompt,
  ].filter(Boolean).join('\n\n');

  const modelsToTry = [model, ...DEFAULT_MODELS].filter(Boolean);
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

      const { data } = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature,
            response_mime_type: 'application/json',
          },
        },
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
      );

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini returned empty response for model ${modelName}`);
      }

      const cleaned = String(text)
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      return JSON.parse(cleaned);
    } catch (err) {
      lastError = err;
      const apiMessage = err.response?.data?.error?.message || err.message || '';
      const modelNotFound = /not found|not supported/i.test(apiMessage);
      if (!modelNotFound) break;
    }
  }

  throw lastError || new Error('Gemini request failed');
}

module.exports = { generateJson };
