const router = require('express').Router();
const auth = require('../middleware/auth');
const axios = require('axios');
const StudySession = require('../models/StudySession');
const StudentProfile = require('../models/StudentProfile');
const Task = require('../models/Task');
const mongoose = require('mongoose');
const { generateJson } = require('../services/geminiService');
const mlService = require('../services/mlService');

const ROLE_RECALIBRATION_MAP = {
  'machine learning engineer': [
    {
      role: 'Data Analyst',
      reason: 'Build confidence with SQL, dashboards, exploratory analysis, and business storytelling before moving into end-to-end ML systems.',
      nextStep: 'Complete 2 analytics projects using Python, SQL, and visualization tools.',
    },
    {
      role: 'Junior Data Scientist',
      reason: 'Focus on model building, evaluation, and feature engineering without the heavier MLOps expectations of ML engineering.',
      nextStep: 'Practice regression, classification, and model evaluation on portfolio datasets.',
    },
  ],
  'ml engineer': [
    {
      role: 'Data Analyst',
      reason: 'A practical bridge role to strengthen data handling and decision-making fundamentals.',
      nextStep: 'Ship one dashboard project and one SQL case study.',
    },
    {
      role: 'Junior Data Scientist',
      reason: 'Helps you strengthen model-building confidence before tackling deployment-heavy ML engineer workflows.',
      nextStep: 'Create a small prediction project with clear metrics and documentation.',
    },
  ],
  'data scientist': [
    {
      role: 'Data Analyst',
      reason: 'A strong first step for mastering data cleaning, analysis, and communication before advanced modeling.',
      nextStep: 'Build 2 dashboard/case-study projects and strengthen SQL.',
    },
  ],
  'software engineer': [
    {
      role: 'Frontend Developer',
      reason: 'Lets you demonstrate product-facing engineering skills with a narrower and more achievable scope.',
      nextStep: 'Build and deploy 2 polished React projects.',
    },
    {
      role: 'QA Engineer',
      reason: 'Improves engineering habits, testing mindset, and SDLC exposure while you keep growing into broader software roles.',
      nextStep: 'Learn API testing and automate one end-to-end test suite.',
    },
  ],
};

function normalizeRole(role = '') {
  return String(role).trim().toLowerCase();
}

function buildActivityAwareIntermediateRoles(targetRole, missingSkills = [], activitySignals = {}) {
  const normalized = normalizeRole(targetRole);
  const mapped = ROLE_RECALIBRATION_MAP[normalized] || [];

  const lowConsistency = (activitySignals.consistencyScore || 0) < 45;
  const lowExecution = (activitySignals.executionScore || 0) < 45;
  const topMissing = missingSkills.slice(0, 3);

  const dynamicFallback = [
    {
      role: 'Project-Based Learner Track',
      reason: lowExecution
        ? 'Your recent task completion and study execution suggest that building consistency through smaller project milestones would be more effective than jumping straight to the final role.'
        : 'A project-first path can help convert current skill gaps into proof of work faster.',
      nextStep: `Complete one small portfolio project focused on ${topMissing.join(', ') || 'your top missing skills'} in the next 10 days.`,
    },
    {
      role: 'Foundations Sprint',
      reason: lowConsistency
        ? 'Your daily learning activity is currently inconsistent, so a shorter structured skill-building phase is more realistic before role targeting.'
        : 'A focused foundations sprint will strengthen the exact skills your target role still needs.',
      nextStep: `Spend 5-7 days strengthening ${topMissing[0] || 'core fundamentals'} with one hour of focused practice daily.`,
    },
  ];

  return mapped.length ? mapped : dynamicFallback;
}

async function getLearningActivitySignals(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [sessions, tasks] = await Promise.all([
    StudySession.find({ userId: oid, startTime: { $gte: fourteenDaysAgo } }).lean(),
    Task.find({ user: oid, date: { $gte: fourteenDaysAgo } }).lean(),
  ]);

  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + ((s.duration || 0) / 60), 0));
  const activeDays = new Set(sessions.map((s) => new Date(s.startTime).toLocaleDateString('en-CA'))).size;
  const focusSessions = sessions.filter((s) => (s.duration || 0) >= 25 * 60).length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks ? completedTasks / totalTasks : 0;

  const consistencyScore = Math.max(0, Math.min(100,
    Math.round(
      (Math.min(activeDays, 10) / 10) * 45
      + (Math.min(totalMinutes, 1200) / 1200) * 35
      + (Math.min(focusSessions, 12) / 12) * 20
    )
  ));

  const executionScore = Math.max(0, Math.min(100,
    Math.round(
      completionRate * 60
      + (Math.min(completedTasks, 10) / 10) * 25
      + (Math.min(focusSessions, 10) / 10) * 15
    )
  ));

  return {
    totalMinutes,
    activeDays,
    focusSessions,
    completedTasks,
    totalTasks,
    completionRate: Math.round(completionRate * 100),
    consistencyScore,
    executionScore,
  };
}

function buildDynamicReadiness(targetRole, skillGap = {}, activitySignals = {}, burnoutScore = 0) {
  const skillReadiness = Math.max(0, Math.min(100, Math.round(skillGap?.match_score || 0)));
  const consistencyScore = activitySignals.consistencyScore || 0;
  const executionScore = activitySignals.executionScore || 0;
  const sustainabilityScore = Math.max(0, 100 - Math.min(100, Math.round(burnoutScore || 0)));

  const readinessScore = Math.max(0, Math.min(100,
    Math.round(
      skillReadiness * 0.5
      + consistencyScore * 0.2
      + executionScore * 0.2
      + sustainabilityScore * 0.1
    )
  ));

  const missingSkills = skillGap?.missing_skills || [];
  const suggestedRoles = readinessScore < 70
    ? buildActivityAwareIntermediateRoles(targetRole, missingSkills, activitySignals)
    : [];

  let status = 'on-track';
  if (readinessScore < 45) status = 'recalibrate';
  else if (readinessScore < 70) status = 'stretch';

  const message = !targetRole
    ? 'Add a target career role in your profile to unlock goal recalibration guidance.'
    : status === 'on-track'
      ? `Your readiness for ${targetRole} is strong because your skills and recent learning activity are aligned.`
      : status === 'stretch'
        ? `You are making progress toward ${targetRole}, but your recent skill coverage and learning consistency still need strengthening before it becomes realistic.`
        : `Your current readiness for ${targetRole} is being held back by both skill gaps and recent learning consistency, so an intermediate path would be smarter right now.`;

  return {
    readinessScore,
    currentRole: targetRole,
    status: targetRole ? status : 'no-target-role',
    message,
    suggestedRoles: targetRole ? suggestedRoles : [],
    matchedSkills: skillGap?.matched_skills || [],
    missingSkills,
    activitySignals,
    skillMatchScore: skillReadiness,
    sustainabilityScore,
  };
}

function getRoleRecalibrationSuggestions(targetRole, readinessScore = 0, missingSkills = []) {
  const normalized = normalizeRole(targetRole);
  const mapped = ROLE_RECALIBRATION_MAP[normalized] || [];

  if (!targetRole) {
    return {
      readinessScore,
      currentRole: null,
      status: 'no-target-role',
      message: 'Add a target career role in your profile to unlock goal recalibration guidance.',
      suggestedRoles: [],
    };
  }

  if (readinessScore >= 70) {
    return {
      readinessScore,
      currentRole: targetRole,
      status: 'on-track',
      message: `Your readiness for ${targetRole} looks strong. Stay on this goal and deepen execution through projects and interview prep.`,
      suggestedRoles: [],
    };
  }

  if (readinessScore >= 45) {
    return {
      readinessScore,
      currentRole: targetRole,
      status: 'stretch',
      message: `Your ${targetRole} goal is achievable, but it is still a stretch right now. Focus first on the top skill gaps: ${missingSkills.slice(0, 3).join(', ') || 'core fundamentals'}.`,
      suggestedRoles: mapped.slice(0, 1),
    };
  }

  return {
    readinessScore,
    currentRole: targetRole,
    status: 'recalibrate',
    message: `Your readiness for ${targetRole} is low right now, so a confidence-building intermediate goal would be smarter before aiming directly for it.`,
    suggestedRoles: mapped.length
      ? mapped
      : [
        {
          role: 'Entry-Level Analyst',
          reason: 'A narrower role can help you collect proof of work, momentum, and stronger fundamentals.',
          nextStep: 'Pick one project-based role path and complete a portfolio piece in the next 2 weeks.',
        },
      ],
  };
}

function buildInterventionPlan(metrics, level, score) {
  const interventions = [];
  const accountabilityPrompts = [];

  if (metrics.studyHours >= 4) {
    interventions.push({
      type: 'break',
      title: 'Protected recovery break',
      action: `You've studied for ${metrics.studyHours} hours. Block the next 30 minutes for a no-screen break, water, and a short walk.`,
      duration: '30 min',
      priority: 'high',
    });
  }

  if (metrics.sleepHours < 6) {
    interventions.push({
      type: 'sleep',
      title: 'Sleep recovery tonight',
      action: 'Stop heavy study 1 hour earlier tonight and target at least 7.5 hours of sleep.',
      duration: 'Tonight',
      priority: 'high',
    });
  }

  if (metrics.deadlinePressure >= 7 || metrics.academicLoad >= 7) {
    interventions.push({
      type: 'load',
      title: 'Reduce cognitive overload',
      action: 'Convert today into a top-3 task list and defer low-impact tasks until tomorrow.',
      duration: '10 min planning',
      priority: 'medium',
    });
  }

  if (metrics.exerciseTime < 2) {
    interventions.push({
      type: 'movement',
      title: 'Stress reset movement',
      action: 'Schedule 20 minutes of light movement today to reduce stress and restore focus.',
      duration: '20 min',
      priority: 'medium',
    });
  }

  if (metrics.socialTime < 1) {
    interventions.push({
      type: 'connection',
      title: 'Accountability check-in',
      action: 'Message one friend, mentor, or teammate today and tell them your main goal for the next 24 hours.',
      duration: '5 min',
      priority: 'medium',
    });
  }

  accountabilityPrompts.push(
    score >= 60
      ? 'Commit to one recovery action in the next hour and one academic priority for tomorrow.'
      : 'Pick one focused study block and one recovery habit to complete today.'
  );

  if (level === 'Critical' || level === 'High') {
    accountabilityPrompts.push('If this pattern continues for a week, reach out to a counselor, mentor, or trusted faculty member.');
  }

  return {
    headline:
      level === 'Critical'
        ? 'High-risk burnout pattern detected — recovery needs to happen before more output.'
        : level === 'High'
          ? 'You are pushing past a healthy study rhythm — act early to prevent escalation.'
          : 'Your routine is still recoverable with a few targeted adjustments.',
    interventions: interventions.slice(0, 4),
    accountabilityPrompts,
  };
}

function sanitizeBurnoutMetrics(payload = {}) {
  const clamp = (value, min, max, fallback) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  };

  return {
    studyHours: clamp(payload.studyHours, 0, 14, 4),
    sleepHours: clamp(payload.sleepHours, 0, 12, 7),
    deadlinePressure: clamp(payload.deadlinePressure, 0, 10, 5),
    academicLoad: clamp(payload.academicLoad, 0, 10, 5),
    exerciseTime: clamp(payload.exerciseTime, 0, 7, 3),
    socialTime: clamp(payload.socialTime, 0, 8, 3),
  };
}

async function saveBurnoutMetricsForUser(userId, payload = {}) {
  const oid = new mongoose.Types.ObjectId(userId);
  const metrics = sanitizeBurnoutMetrics(payload);

  const profile = await StudentProfile.findOneAndUpdate(
    { userId: oid },
    {
      $set: { burnoutMetrics: metrics },
      $setOnInsert: { userId: oid },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return { profile, metrics };
}

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Try to get saved metrics first
    const profile = await StudentProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    let metrics = profile?.burnoutMetrics;

    if (!metrics) {
      // Fallback to study session average
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const avgResult = await StudySession.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
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
    const { profile, metrics } = await saveBurnoutMetricsForUser(req.user.id, req.body);
    res.json({
      success: true,
      message: 'Metrics saved successfully',
      burnoutMetrics: profile.burnoutMetrics || metrics,
      updatedAt: profile.updatedAt,
    });
  } catch (err) {
    console.error('Save metrics error:', err);
    res.status(500).json({ message: 'Error saving metrics', error: err.message });
  }
});

// Enhanced dynamic suggestions in predict
router.post('/predict', auth, async (req, res) => {
  try {
    const { studyHours, sleepHours, socialTime, exerciseTime, deadlinePressure, academicLoad } = sanitizeBurnoutMetrics(req.body);
    const userId = req.user.id;
    const { profile } = await saveBurnoutMetricsForUser(userId, {
      studyHours,
      sleepHours,
      socialTime,
      exerciseTime,
      deadlinePressure,
      academicLoad,
    });
    const targetRole = profile?.targetRole || profile?.customRole || profile?.goals?.[0]?.goal || null;
    const userSkills = [
      ...(profile?.extractedSkills || []),
      ...(profile?.extraSkills || []),
    ];

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
      suggestions = [...suggestions.slice(0, 2), ...levelSuggestions[level] || []];

      let readiness = null;
      if (targetRole) {
        try {
          const [skillGap, activitySignals] = await Promise.all([
            mlService.getSkillGap(userSkills, targetRole),
            getLearningActivitySignals(userId),
          ]);
          readiness = buildDynamicReadiness(targetRole, skillGap, activitySignals, score);
        } catch (e) {
          const activitySignals = await getLearningActivitySignals(userId).catch(() => ({}));
          readiness = buildDynamicReadiness(targetRole, { match_score: 0, matched_skills: [], missing_skills: [] }, activitySignals, score);
        }
      } else {
        readiness = getRoleRecalibrationSuggestions(null, 0, []);
      }

      const coach = buildInterventionPlan({ studyHours, sleepHours, socialTime, exerciseTime, deadlinePressure, academicLoad }, level, score);

      if (profile) {
        profile.burnoutCoach = profile.burnoutCoach || {};
        profile.burnoutCoach.lastRisk = {
          score,
          level,
          confidence,
          predictedAt: new Date(),
        };
        await profile.save();
      }

      return res.json({ score, level, suggestions, confidence, source: 'ML', coach, readiness });
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
    suggestions = [...suggestions.slice(0, 3), ...(levelSugs[level] || [])];

    let readiness = null;
    if (targetRole) {
      try {
        const [skillGap, activitySignals] = await Promise.all([
          mlService.getSkillGap(userSkills, targetRole),
          getLearningActivitySignals(userId),
        ]);
        readiness = buildDynamicReadiness(targetRole, skillGap, activitySignals, score);
      } catch (e) {
        const activitySignals = await getLearningActivitySignals(userId).catch(() => ({}));
        readiness = buildDynamicReadiness(targetRole, { match_score: 0, matched_skills: [], missing_skills: [] }, activitySignals, score);
      }
    } else {
      readiness = getRoleRecalibrationSuggestions(null, 0, []);
    }

    const coach = buildInterventionPlan({ studyHours, sleepHours, socialTime, exerciseTime, deadlinePressure, academicLoad }, level, score);

    if (profile) {
      profile.burnoutCoach = profile.burnoutCoach || {};
      profile.burnoutCoach.lastRisk = {
        score,
        level,
        confidence: null,
        predictedAt: new Date(),
      };
      await profile.save();
    }

    res.json({ score, level, suggestions, coach, readiness, source: 'rule-based' });
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

function _buildFallbackCoachReply(message, metrics = {}) {
  const normalized = String(message || '').toLowerCase();
  const stressSignals = [];

  if ((metrics.sleepHours || 0) < 6) stressSignals.push('protect sleep tonight');
  if ((metrics.studyHours || 0) >= 6) stressSignals.push('reduce study intensity for the next block');
  if ((metrics.deadlinePressure || 0) >= 7) stressSignals.push('shrink today into only top 3 priorities');
  if ((metrics.exerciseTime || 0) < 2) stressSignals.push('add a short walk or light movement today');

  const detectedFeeling = normalized.includes('tired')
    ? 'You sound mentally and physically tired.'
    : normalized.includes('stress') || normalized.includes('overwhelm')
      ? 'You sound overloaded right now.'
      : 'Thanks for sharing how you are feeling.';

  const assistantReply = `${detectedFeeling} For today, focus on ${stressSignals[0] || 'one recovery habit and one realistic study goal'}. I can still help you with a simple recovery plan even if the AI provider is unavailable right now.`;

  return {
    assistantReply,
    nextQuestions: [
      'What is the most urgent deadline this week?',
      'How many focused study hours can you realistically handle tomorrow without exhaustion?',
    ],
    plan: {
      summary: 'A lightweight fallback plan to reduce overload and restore consistency for the next 7 days.',
      dailyPlan: [
        { day: 'Day 1', focus: 'Reset', actions: ['Take one proper break today', 'Sleep at least 7 hours tonight', 'List only top 3 tasks'] },
        { day: 'Day 2', focus: 'Stabilize', actions: ['Use 2 focused study blocks', 'Take a walk or stretch for 20 minutes', 'Avoid multitasking'] },
        { day: 'Day 3', focus: 'Catch up calmly', actions: ['Work on the highest-impact deadline first', 'Ask for help early if blocked', 'Stop work on time'] },
        { day: 'Day 4', focus: 'Recover', actions: ['Keep sleep consistent', 'Do one enjoyable low-stress activity', 'Review progress without self-criticism'] },
        { day: 'Day 5', focus: 'Build momentum', actions: ['Finish one important task', 'Take planned breaks', 'Check in with a friend or mentor'] },
        { day: 'Day 6', focus: 'Light workload', actions: ['Do maintenance work only', 'Limit screen fatigue', 'Move your body'] },
        { day: 'Day 7', focus: 'Weekly reset', actions: ['Review what helped most', 'Prepare a realistic next week plan', 'Protect recovery time'] },
      ],
      redFlags: ['repeated sleep below 6 hours', 'daily overwhelm for more than a week', 'skipping meals or breaks'],
      checkIn: 'At the end of the week, ask: Do I feel more in control and less exhausted than I did today?',
    },
    provider: 'fallback',
  };
}

async function _getOrCreateProfile(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
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
      + 'Goal: ask concise follow-up questions only when absolutely needed, and otherwise produce a practical 7-day plan immediately.\n'
      + 'Constraints: no medical claims; be supportive; keep reply very short; avoid generic therapy-style language; be specific and actionable.\n'
      + 'Do not say phrases like "I hear you", "thanks for sharing", or long empathy intros. Start directly with action.\n'
      + 'If the user already mentions feeling overwhelmed/tired/stressed plus at least one deadline or workload issue, that is enough information to give a first plan now.\n\n'
      + `User metrics (may be incomplete): ${JSON.stringify(metrics)}\n\n`
      + 'Conversation so far:\n'
      + lastMsgs
      + '\n\n'
      + 'If you have enough info, output a 7-day plan. Otherwise output nextQuestions.'
    );

    let ai;
    let provider = 'gemini';
    try {
      ai = await generateJson({ prompt, schemaHint, model: 'gemini-2.5-flash', temperature: 0.3 });
    } catch (aiErr) {
      console.error('Burnout coach AI fallback triggered:', aiErr.response?.data || aiErr.message);
      ai = _buildFallbackCoachReply(message, metrics);
      provider = ai.provider || 'fallback';
    }

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
      provider,
    });
  } catch (err) {
    console.error('Coach message hard failure:', err.response?.data || err.message);

    const fallback = _buildFallbackCoachReply(req.body?.message || '', {});
    return res.json({
      threadId: `fallback_${req.user?.id || 'user'}_${Date.now()}`,
      stage: 'planned',
      assistantReply: fallback.assistantReply,
      nextQuestions: fallback.nextQuestions,
      plan: fallback.plan,
      messages: [
        ...(req.body?.message ? [{ role: 'user', content: String(req.body.message), createdAt: new Date() }] : []),
        { role: 'assistant', content: fallback.assistantReply, createdAt: new Date() },
      ],
      provider: 'fallback',
      error: err.message,
    });
  }
});

module.exports = router;













