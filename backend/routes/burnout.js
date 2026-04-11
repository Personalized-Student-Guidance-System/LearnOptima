const router = require('express').Router();
const auth = require('../middleware/auth');
const axios = require('axios');
const StudySession = require('../models/StudySession');
const StudentProfile = require('../models/StudentProfile');
const mongoose = require('mongoose');
const { generateJson } = require('../services/geminiService');

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Try to get saved metrics first
    const profile = await StudentProfile.findOne({ userId: mongoose.Types.ObjectId(userId) });
    let metrics = profile?.burnoutMetrics;
    
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
        socialTime: 3,
        _fromProfile: false,
      };
    } else {
      metrics = {
        ...metrics.toObject?.() || metrics,
        _fromProfile: true,
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

// ─────────────────────────────────────────────────────────────────────────────
// Agentic coach (backend-only) powered by Gemini
// ─────────────────────────────────────────────────────────────────────────────

function _mkCoachIntro() {
  return (
    'I can help you reduce burnout risk with a short check-in. ' +
    'Answer a few questions and I will create a plan you can follow for the next 7 days.\n\n' +
    'Q1) How are you feeling today? (e.g., anxious/tired/okay)\n' +
    'Q2) What is your biggest stressor right now?\n' +
    'Q3) Do you have any urgent deadline in the next 7 days? If yes, what and when?'
  );
}

async function _getOrCreateProfile(userId) {
  const oid = mongoose.Types.ObjectId(userId);
  let profile = await StudentProfile.findOne({ userId: oid });
  if (!profile) {
    profile = await StudentProfile.create({ userId: oid });
  }
  return profile;
}

function _appendCoachMessage(profile, role, content) {
  profile.burnoutCoach = profile.burnoutCoach || {};
  profile.burnoutCoach.messages = profile.burnoutCoach.messages || [];
  profile.burnoutCoach.messages.push({ role, content, createdAt: new Date() });
}

function _latestMessages(profile, limit = 12) {
  const msgs = profile?.burnoutCoach?.messages || [];
  return msgs.slice(Math.max(0, msgs.length - limit));
}

// Start (or resume) a coaching thread
router.post('/coach/start', auth, async (req, res) => {
  try {
    const profile = await _getOrCreateProfile(req.user.id);

    if (!profile.burnoutCoach) profile.burnoutCoach = { stage: 'intro', messages: [] };

    // If no messages yet, send intro
    if (!profile.burnoutCoach.messages || profile.burnoutCoach.messages.length === 0) {
      _appendCoachMessage(profile, 'assistant', _mkCoachIntro());
      profile.burnoutCoach.stage = 'collecting';
      profile.burnoutCoach.threadId = profile.burnoutCoach.threadId || `burnout_${profile.userId}_${Date.now()}`;
      await profile.save();
    }

    res.json({
      threadId: profile.burnoutCoach.threadId,
      stage: profile.burnoutCoach.stage,
      messages: _latestMessages(profile),
      plan: profile.burnoutCoach.plan || null,
      lastRisk: profile.burnoutCoach.lastRisk || null,
      provider: process.env.GEMINI_API_KEY ? 'gemini' : 'fallback-unavailable',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Submit a user message; assistant responds (may create/update plan)
router.post('/coach/message', auth, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'message is required' });
    }

    const profile = await _getOrCreateProfile(req.user.id);
    if (!profile.burnoutCoach) profile.burnoutCoach = { stage: 'intro', messages: [] };

    _appendCoachMessage(profile, 'user', message.trim());

    const metrics = profile.burnoutMetrics || {};
    const lastMsgs = _latestMessages(profile, 12)
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const schemaHint = (
      'Schema: {'
      + '"assistantReply": string,'
      + '"nextQuestions": string[],'
      + '"plan": {'
      + '  "summary": string,'
      + '  "dailyPlan": [{"day": string, "focus": string, "actions": string[]}],' 
      + '  "redFlags": string[],'
      + '  "checkIn": string'
      + '} | null'
      + '}'
    );

    const prompt = (
      'You are an agentic burnout coach for a student.\n'
      + 'Goal: ask concise follow-up questions when needed, and produce a practical 7-day plan.\n'
      + 'Constraints: no medical claims; be supportive; keep reply short; be specific.\n\n'
      + `User metrics (may be incomplete): ${JSON.stringify(metrics)}\n\n`
      + 'Conversation so far:\n'
      + lastMsgs
      + '\n\n'
      + 'If you have enough info, output a 7-day plan. Otherwise output nextQuestions.'
    );

    const ai = await generateJson({ prompt, schemaHint, model: 'gemini-1.5-flash', temperature: 0.3 });

    const reply = String(ai.assistantReply || '').trim() || 'Thanks—tell me a bit more so I can tailor a plan.';
    _appendCoachMessage(profile, 'assistant', reply);

    if (ai.plan) {
      profile.burnoutCoach.plan = ai.plan;
      profile.burnoutCoach.stage = 'planned';
    } else {
      profile.burnoutCoach.stage = 'collecting';
    }

    await profile.save();

    res.json({
      threadId: profile.burnoutCoach.threadId,
      stage: profile.burnoutCoach.stage,
      assistantReply: reply,
      nextQuestions: Array.isArray(ai.nextQuestions) ? ai.nextQuestions : [],
      plan: profile.burnoutCoach.plan || null,
      messages: _latestMessages(profile),
      provider: 'gemini',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;





