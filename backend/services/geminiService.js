const axios = require('axios');

// Minimal Gemini wrapper (Google Generative Language API)
// Uses env var GEMINI_API_KEY (place in backend/.env)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateJson({ prompt, schemaHint = '', model = 'gemini-1.5-flash', temperature = 0.2 }) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const fullPrompt = [
    schemaHint ? `Return ONLY valid JSON. ${schemaHint}` : 'Return ONLY valid JSON.',
    prompt,
  ].filter(Boolean).join('\n\n');

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
    throw new Error('Gemini returned empty response');
  }

  const cleaned = String(text)
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

module.exports = { generateJson };
