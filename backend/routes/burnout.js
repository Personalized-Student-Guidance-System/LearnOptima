const router = require('express').Router();
const auth = require('../middleware/auth');
const axios = require('axios');

router.post('/predict', auth, async (req, res) => {
  try {
    const { studyHours, sleepHours, socialTime, exerciseTime, deadlinePressure, academicLoad } = req.body;
    
    // Rule-based fallback (ML API optional)
    let score = 0;
    if (studyHours > 8) score += 25;
    else if (studyHours > 6) score += 15;
    if (sleepHours < 6) score += 25;
    else if (sleepHours < 7) score += 10;
    if (socialTime < 1) score += 15;
    if (exerciseTime < 1) score += 10;
    score += (deadlinePressure / 10) * 15;
    score += (academicLoad / 10) * 10;
    score = Math.min(100, score);

    const level = score < 30 ? 'Low' : score < 60 ? 'Moderate' : score < 80 ? 'High' : 'Critical';
    const suggestions = score < 30
      ? ['Great balance! Keep up your current routine.', 'Consider setting long-term goals.']
      : score < 60
      ? ['Take short breaks every 90 minutes.', 'Ensure 7-8 hours sleep nightly.', 'Schedule social activities.']
      : score < 80
      ? ['Reduce study hours and focus on quality.', 'Daily 30-min exercise is essential.', 'Talk to a counselor or friend.', 'Use Pomodoro technique.']
      : ['Immediate break recommended.', 'Speak with academic advisor.', 'Prioritize sleep above all.', 'Seek professional mental health support.'];

    res.json({ score: Math.round(score), level, suggestions });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;