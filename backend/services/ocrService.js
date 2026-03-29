const mlService = require('./mlService');

async function extractTimetable(imageUrl) {
  return mlService.extractTimetable(imageUrl);
}

module.exports = { extractTimetable };
