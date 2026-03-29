/**
 * Fallback / utility for skill extraction when ML service is unavailable.
 * Primary extraction is done via ML service (resume parsing).
 */
function extractFromText(text) {
  if (!text || typeof text !== 'string') return [];
  return [];
}

module.exports = { extractFromText };
