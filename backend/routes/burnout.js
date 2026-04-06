const router = require('express').Router();
const auth = require('../middleware/auth');
const axios = require('axios');
const StudySession = require('../models/StudySession');
const StudentProfile = require('../models/StudentProfile');
const mongoose = require('mongoose');

router.get('/burnout', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Try to get saved metrics first
    let metrics = await StudentProfile.findOne({ userId: mongoose.Types.ObjectId(userId) }).then(p => p?.burnoutMetrics);
    
    if (!metrics) {
      // Fallback to study session average
      const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);
      const avgResult = await StudySession.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            startTime: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$startTime'
              }
            },
            totalDuration: { $sum: '$duration' }
          }
        },
        {
          $group: {
            _id: null,
            avgDailySeconds: { $avg: '$totalDuration' }
          }
        }
      ]);
      
      const avgStudySeconds = avgResult[0]?.avgDailySeconds || 0;
      const avgStudyHours = Math.round((avgStudySeconds / 3600) * 10) / 10 || 4;
      
      metrics = {
        studyHours: avgStudyHours,
        sleepHours: 7,
        deadlinePressure: 5,
        academicLoad: 5,
        exerciseTime: 3,
        socialTime: 3
      };
    }
    
    // Quick rule-based riskLevel for dashboard
    let score = 0;
    if (metrics.studyHours > 8) score += 25;
    if (metrics.sleepHours < 6) score += 25;
    const level = score < 30 ? 'low' : score < 60 ? 'medium' : 'high';
    
    res.json({ ...metrics, riskLevel: level, source: metrics._fromProfile ? 'saved' : 'computed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching burnout data' });
  }
});

router.post('/save-metrics', auth, async (req, res) => {
  try {
    console.log('Save metrics called, user:', req.user.id, 'body:', req.body);
    
    const userId = mongoose.Types.ObjectId(req.user.id);
    const metrics = req.body;
    
    const profile = await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: { burnoutMetrics: metrics } },
      { upsert: true, new: true }
    );
    
    console.log('Profile saved:', profile._id, 'metrics:', profile.burnoutMetrics);
    res.json({ success: true, message: 'Metrics saved successfully' });
  } catch (err) {
    console.error('Save metrics error:', err);
    res.status(500).json({ message: 'Error saving metrics', error: err.message });
  }
});

// Enhanced dynamic suggestions in predict
router.post('/predict', auth, async (req, res) => {
  try {
    const { studyHours, sleepHours, socialTime, exerciseTime, deadlinePressure, academicLoad } = req.body;
    
    // Try ML API first
    try {
      const mlRes = await axios.post('http://localhost:5001/predict-burnout', {
        studyHours, sleepHours, socialTime, exerciseTime, deadlinePressure, academicLoad
      });
      
      let level = mlRes.data.level;
      let confidence = mlRes.data.confidence || 0;
      const scoreMap = { 'Low': 25, 'Moderate': 50, 'High': 75, 'Critical': 95 };
      let score = scoreMap[level] || 50;
      
      let suggestions = [];
      // Dynamic metric-specific suggestions
      if (sleepHours < 6) suggestions.push('Prioritize sleep: Aim for 7-8 hours nightly. Poor sleep multiplies burnout risk 3x.');
      if (studyHours > 8) suggestions.push('Reduce study load: Max 6 hours/day + quality breaks. Long sessions lose efficiency.');
      if (exerciseTime < 2) suggestions.push('Add movement: 30 min daily exercise reduces stress hormones significantly.');
      if (socialTime < 1) suggestions.push('Schedule connection: 1 social interaction/day prevents isolation burnout.');
      if (deadlinePressure > 7) suggestions.push('Stress relief: Try 10-min meditation or deep breathing when pressure peaks.');
      
      // Add level-based
      const levelSuggestions = {
        'Low': ['Great balance! Consider long-term goals.'],
        'Moderate': ['Pomodoro: 45min study → 15min break.'],
        'High': ['Counselor check-in recommended. Quality > quantity.'],
        'Critical': ['Immediate 2-day reset. Professional help if persists.']
      };
      suggestions = [...suggestions.slice(0,2), ...levelSuggestions[level] || []];
      
      return res.json({ score, level, suggestions, confidence, source: 'ML' });
    } catch (mlErr) {
      console.log('ML unavailable, rule-based');
    }
    
    // Rule-based with dynamic suggestions
    let score = 0;
    if (studyHours > 8) score += 25; else if (studyHours > 6) score += 15;
    if (sleepHours < 6) score += 25; else if (sleepHours < 7) score += 10;
    if (socialTime < 1) score += 15;
    if (exerciseTime < 1) score += 10;
    score += (deadlinePressure / 10) * 15 + (academicLoad / 10) * 10;
    score = Math.min(100, Math.round(score));

    const level = score < 30 ? 'Low' : score < 60 ? 'Moderate' : score < 80 ? 'High' : 'Critical';
    let suggestions = [];
    if (sleepHours < 6) suggestions.push('Sleep emergency: Under 6h = 3x burnout risk. Bed by 11pm.');
    if (studyHours > 8) suggestions.push('Study cap: 6h max/day. Diminishing returns after.');
    if (exerciseTime < 2) suggestions.push('Move daily: 20min walk cuts stress 40%.');
    if (socialTime < 1) suggestions.push('Connect: One call/text/day fights isolation.');
    if (deadlinePressure > 7) suggestions.push('Pressure valve: 5min breathing every 2h.');
    
    const levelSugs = {
      Low: ['Balanced routine! Add variety.'],
      Moderate: ['90min cycles + breaks. Weekend reset.'],
      High: ['Counseling + time audit.'],
      Critical: ['48h reset protocol. Prof help.']
    };
    suggestions = [...suggestions.slice(0,3), ...(levelSugs[level] || [])];
    
    res.json({ score, level, suggestions });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

