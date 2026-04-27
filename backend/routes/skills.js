const router = require('express').Router();
const auth = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Task = require('../models/Task');
const axios = require('axios');
const { orchestrateDailyForUser } = require('../services/centralPlannerOrchestrator');

const ML_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function parseTimeToMinutes(value, fallback) {
  const v = String(value || fallback || '00:00');
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return parseTimeToMinutes(fallback || '00:00', '00:00');
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return hh * 60 + mm;
}

function minutesToTime(min) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function resolveTargetRole({ queryRole, profile, user }) {
  const q = String(queryRole || '').trim();
  if (q) return q;

  const profileTargetRoles = Array.isArray(profile?.targetRoles)
    ? profile.targetRoles.filter(Boolean).map((r) => String(r).trim()).filter(Boolean)
    : [];
  const userTargetRoles = Array.isArray(user?.targetRoles)
    ? user.targetRoles.filter(Boolean).map((r) => String(r).trim()).filter(Boolean)
    : [];

  return (
    String(profile?.targetRole || '').trim()
    || profileTargetRoles[0]
    || String(user?.targetRole || '').trim()
    || userTargetRoles[0]
    || 'Software Engineer'
  );
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(arr) ? arr : []) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// ─── Spawn Python skill_gap_analyzer.py ────────────────────────────────────────
function runPythonSkillGap(userSkills, role, location = 'India', refresh = false) {
  return new Promise((resolve, reject) => {
    const pyPath = path.join(__dirname, '../ml/skill_gap_analyzer.py');
    const skillsArg = userSkills.join(',') || 'none';

    const args = [
      pyPath,
      '--skills', skillsArg,
      '--role', role,
      '--location', location,
    ];

    if (refresh) {
      args.push('--refresh');
    }

    const proc = spawn('python', args, { cwd: path.join(__dirname, '../ml') });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);

    proc.on('close', code => {
      if (code !== 0) {
        console.error('[SkillML] Python exit', code, stderr.slice(0, 400));
        return reject(new Error(`Python exited ${code}: ${stderr.slice(0, 200)}`));
      }
      try {
        // find first '{' in case there is print noise before the JSON
        const start = stdout.indexOf('{');
        if (start === -1) throw new Error('No JSON in output');
        resolve(JSON.parse(stdout.slice(start)));
      } catch (e) {
        reject(new Error(`Parse error: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on('error', err => reject(new Error(`Spawn error: ${err.message}`)));
  });
}

// ─── Cache helper ─────────────────────────────────────────────────────────────
function getCacheKey(role) {
  return `skillgap_${role.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}
// ─── Cache helper (Global memory cache in Node) ──────────────────────────────
function getCache(role) {
  const key = getCacheKey(role);
  const entry = global[key];
  if (entry && (Date.now() - entry.ts < ML_CACHE_TTL)) {
    // If we've updated the logic to favor O*NET, we might want to bypass old non-onet-api caches
    if (entry.data && entry.data.source === 'ml-cache-old') {
      return null;
    }
    return entry.data;
  }
  return null;
}
function setCache(role, data) {
  global[getCacheKey(role)] = { data, ts: Date.now() };
}

// ─── Map ML output → frontend shape ───────────────────────────────────────────
function mapMlToFrontend(mlResult, userSkills, profile) {
  // Extract skill names safely (handle null, objects, and strings)
  const getSkillName = (s) => {
    if (!s) return "Unknown Skill";
    if (typeof s === 'object') return s.skill || "Unknown Skill";
    return String(s);
  };
  
  const rawMatched = mlResult.matched_skills || [];
  const rawMissing = mlResult.missing_skills || [];
  const requiredList = mlResult.required_skills || [];

  const highPriority = mlResult.high_priority_gaps || [];
  const mediumPriority = mlResult.medium_priority_gaps || [];

  const urgencyFor = (sObj) => {
    const sname = getSkillName(sObj);
    const sl = sname.toLowerCase();
    
    const isHigh = highPriority.some(h => {
        const hname = typeof h === 'string' ? h : h?.skill;
        return hname && hname.toLowerCase() === sl;
    });
    if (isHigh) return 'Critical';

    const isMed = mediumPriority.some(m => {
        const mname = typeof m === 'string' ? m : m?.skill;
        return mname && mname.toLowerCase() === sl;
    });
    if (isMed) return 'High';

    return 'Medium';
  };

  // Build missing skill objects
  const missingSkills = rawMissing.map((s, i) => {
    const sname = getSkillName(s);
    return {
      skill: sname,
      urgency: urgencyFor(s),
      priority_score: s?.priority || Math.max(40, 95 - i * 4),
      interview_frequency: Math.max(40, 92 - i * 4),
      time_to_proficiency_days: 20 + i * 5,
      description: s?.description || '',
      recommendation: s?.recommendation || ''
    };
  });

  // Use Python's pre-calculated top priorities if available, else derive
  let topPriorities = mlResult.top_5_priorities;
  if (!topPriorities || topPriorities.length === 0) {
    const urgencyOrder = { Critical: 0, High: 1, Medium: 2 };
    topPriorities = [...missingSkills]
      .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
      .slice(0, 10);
  }

  const matched = rawMatched.map(s => ({ 
    skill: getSkillName(s), 
    importance: s?.score || 80 
  }));

  const matchScore = Math.round(mlResult.match_score || 0);
  const totalRequired = requiredList.length || (matched.length + missingSkills.length);

  const analysisText = matchScore >= 80
    ? `Great — you already cover ${matched.length} of ${totalRequired} skills required.`
    : matchScore >= 60
      ? `Good progress! You cover ${matched.length} of ${totalRequired} skills.`
      : `You have ${matched.length} of ${totalRequired} core matched skills for this role.`;

  return {
    overview: {
      match_score: matchScore,
      matched_count: matched.length,
      missing_count: missingSkills.length,
      total_required: totalRequired,
      analysis: analysisText,
      key_insight: mlResult.key_insight || '',
    },
    matched_skills: matched,
    missing_skills: missingSkills,
    top_5_priorities: topPriorities,
    learning_queue: profile?.skillsToLearn || [],
    role: mlResult.role,
    userSkillsCount: userSkills.length,
    required_skills: requiredList,
    estimated_weeks: mlResult.estimated_weeks || 24,
    source: mlResult.ml_pipeline || 'onet-authority-hybrid',
  };
}

// ─── GET /skills/analyze ───────────────────────────────────────────────────────
// Calls Python ML scraper (Naukri + LinkedIn + Claude) for any role.
// Results are cached 1 hour so subsequent loads are instant.
router.get('/analyze', auth, async (req, res) => {
  const userId = req.user.id;
  const queryRole = req.query.role;

  const profile = await StudentProfile.findOne({ userId }).catch(() => null);
  const user = await User.findById(userId).catch(() => null);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const targetRole = resolveTargetRole({ queryRole, profile, user });

  // Combine all user skills
  const allSkills = [
    ...(profile?.extractedSkills || []),
    ...(profile?.extraSkills || []),
    ...(user?.skills || []),
  ].filter((s, i, a) => s && a.indexOf(s) === i);

  // Check cache first
  const refreshRequested = req.query.refresh === 'true';
  const cached = refreshRequested ? null : getCache(targetRole);
  if (cached) {
    console.log(`[SkillML] Cache HIT for "${targetRole}"`);
    // re-merge user's live learning_queue
    return res.json({
      ...cached,
      learning_queue: profile?.skillsToLearn || [],
      userSkillsCount: allSkills.length,
    });
  }

  // Run Python ML scraper
  console.log(`[SkillML] Running Python scraper for "${targetRole}"…`);
  try {
    const mlResult = await runPythonSkillGap(allSkills, targetRole, 'India', refreshRequested);
    
    if (mlResult.error) {
      console.error(`[SkillML] Python Logic Error: ${mlResult.error}`);
      console.error(`[SkillML] Traceback:\n${mlResult.traceback}`);
      throw new Error(mlResult.error);
    }

    const frontendData = mapMlToFrontend(mlResult, allSkills, profile);
    setCache(targetRole, frontendData);
    return res.json(frontendData);
  } catch (mlErr) {
    console.error('[SkillML] Python execution failed:', mlErr.message);
    return res.status(500).json({
      message: `ML analysis failed: ${mlErr.message}`,
      details: 'Check server logs for the full Python traceback.',
    });
  }
});

// ─── GET /skills/ai-recommendation ───────────────────────────────────────────
// Returns role-specific AI action plan derived from O*NET and live results.
router.get('/ai-recommendation', auth, async (req, res) => {
  const userId = req.user.id;
  const queryRole = req.query.role;

  const profile = await StudentProfile.findOne({ userId }).catch(() => null);
  const user = await User.findById(userId).catch(() => null);

  const allSkills = [
    ...(profile?.extractedSkills || []),
    ...(profile?.extraSkills || []),
    ...(user?.skills || []),
  ].filter((s, i, a) => s && a.indexOf(s) === i);

  const targetRole = resolveTargetRole({ queryRole, profile, user });

  // Get cached ML data to feed the recommendation
  const cached = getCache(targetRole);
  
  // If no cache yet, return a minimal plan so callers (e.g. Skill Gap page) do not fail in parallel with /analyze
  if (!cached) {
    const topSkill = 'Core fundamentals';
    return res.json({
      analysis: `Run skill analysis first for a detailed market breakdown. Baseline guidance for ${targetRole}: strengthen ${topSkill} and document proof in projects.`,
      action_plan: [
        { week: '1–2', focus: 'Foundations', action: `Review role requirements and start with ${topSkill}.` },
        { week: '3–4', focus: 'Practice', action: 'Complete one small project that maps to your target role.' },
      ],
      strengths: allSkills.slice(0, 3),
      weaknesses: ['Complete /skills/analyze for live gap data'],
      next_steps: ['Open Skill Gap Analyzer and wait for analysis to finish', 'Add missing skills to your learning queue'],
      estimated_time_to_ready_weeks: 24,
      role: targetRole,
      source: 'placeholder-until-analyze',
    });
  }

  const missingSkills = cached.missing_skills || [];
  const highPriority = cached.top_5_priorities || [];
  const estimatedWeeks = cached.estimated_weeks || 24;

  // ─── Local Deterministic "AI" Engine (O*NET Driven) ───
  // This replaces Gemini to avoid quota errors and ensure consistency.
  
  const skillCount = allSkills.length;
  const topSkill = highPriority[0]?.skill || (missingSkills[0]?.skill) || "Core Fundamentals";
  
  const analysis = skillCount >= 10
    ? `You have a strong foundation with ${skillCount} skills. For ${targetRole}, our O*NET analysis indicates your final hurdles are ${topSkill} and advanced specialization. Focus on project-based validation.`
    : `With ${skillCount} skills documented, you are currently in the 'Developing' phase for ${targetRole}. Your quickest path to readiness is mastering ${topSkill}, which O*NET identifies as a critical role foundation.`

  // Generate dynamic action plan from O*NET priorities
  const actionPlan = [
    { 
      week: '1–4', 
      focus: 'Critical Foundations', 
      action: `Master ${topSkill}. Our live data shows this is the most requested competency for ${targetRole} recruiters.` 
    },
    { 
      week: '5–8', 
      focus: 'Tooling & Environment', 
      action: `Build projects using ${highPriority[1]?.skill || 'industry-standard tools'}. Focus on the descriptions provided in your Skill Gap table.` 
    },
    { 
      week: '9–14', 
      focus: 'Domain Integration', 
      action: `Apply ${highPriority[2]?.skill || 'theoretical knowledge'} to solve a real-world problem. Create a GitHub case study.` 
    },
    { 
      week: '15–' + estimatedWeeks, 
      focus: 'Market Readiness', 
      action: `Finalize your portfolio with the 'Matched' skills and start targeted outreach for ${targetRole} positions.` 
    }
  ];

  const nextSteps = [
    `1. Start learning "${topSkill}" immediately — it has the highest impact on your match score.`,
    `2. Read the O*NET descriptions for your top 5 gaps to understand professional expectations.`,
    `3. Add "${highPriority[1]?.skill || 'the next priority skill'}" to your Learning Queue.`,
    `4. Map your existing ${skillCount} skills to ${targetRole} use-cases in your resume.`,
    `5. Build one 'Full-Stack' project that combines your top 3 missing priority skills.`
  ];

  const weaknesses = highPriority.slice(0, 3).map(s => `${s.skill}: ${s.description.slice(0, 60)}...`);

  res.json({
    analysis,
    action_plan: actionPlan,
    strengths: allSkills.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    weaknesses: weaknesses.length ? weaknesses : [`Core ${targetRole} requirements`],
    next_steps: nextSteps,
    estimated_time_to_ready_weeks: estimatedWeeks,
    role: targetRole,
    source: 'onet-deterministic-engine',
  });
});

// ─── GET /skills/learning-path ───────────────────────────────────────────────
// Kept for backward compatibility — returns minimal data
router.get('/learning-path', auth, async (req, res) => {
  const profile = await StudentProfile.findOne({ userId: req.user.id }).catch(() => null);
  const user = await User.findById(req.user.id).catch(() => null);
  const targetRole = resolveTargetRole({ queryRole: req.query.role, profile, user });
  const cached = getCache(targetRole);

  res.json({
    role: targetRole,
    total_duration_weeks: cached?.estimated_weeks || 24,
    skills_to_learn: profile?.skillsToLearn || [],
    note: 'Full learning path available in Career Roadmap',
  });
});

// ─── PUT /skills/learning-queue ──────────────────────────────────────────────
router.put('/learning-queue', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { skill, action } = req.body;
    let profile = await StudentProfile.findOne({ userId });
    if (!profile) {
      // Auto-create profile if missing
      profile = new StudentProfile({ userId, skillsToLearn: [] });
    }
    if (action === 'add') {
      const normalizedSkill = String(skill || '').trim();
      if (!normalizedSkill) {
        return res.status(400).json({ message: 'Skill is required' });
      }
      if (!profile.skillsToLearn) profile.skillsToLearn = [];
      if (!profile.skillsToLearn.some((s) => String(s || '').trim().toLowerCase() === normalizedSkill.toLowerCase())) {
        profile.skillsToLearn.push(normalizedSkill);
      }
    } else if (action === 'remove') {
      const normalizedSkill = String(skill || '').trim().toLowerCase();
      profile.skillsToLearn = (profile.skillsToLearn || []).filter(
        (s) => String(s || '').trim().toLowerCase() !== normalizedSkill
      );
      if (normalizedSkill) {
        try {
          await Task.deleteMany({
            user: userId,
            completed: false,
            title: new RegExp(`^Learn:\\s*${normalizedSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          });
        } catch (taskErr) {
          console.error('[LearningQueue] Failed to remove queued planner task:', taskErr.message);
        }
      }
    } else if (action === 'complete') {
      const normalizedSkill = String(skill || '').trim();
      if (normalizedSkill) {
        // remove from learning queue
        profile.skillsToLearn = (profile.skillsToLearn || []).filter(
          (s) => String(s || '').trim().toLowerCase() !== normalizedSkill.toLowerCase()
        );

        // add to profile extraSkills (source of truth for manual skills)
        const existingExtra = uniqStrings(profile.extraSkills || []);
        const hasAlready = existingExtra.some((s) => s.toLowerCase() === normalizedSkill.toLowerCase());
        if (!hasAlready) {
          existingExtra.push(normalizedSkill);
          profile.extraSkills = existingExtra;
        }

        // also mirror into User.skills for older parts of the app
        try {
          const user = await User.findById(userId).select('skills');
          if (user) {
            const merged = uniqStrings([...(user.skills || []), normalizedSkill]);
            user.skills = merged;
            await user.save();
          }
        } catch (e) {
          console.warn('[LearningQueue] Could not mirror completed skill into User.skills:', e.message);
        }

        try {
          await Task.deleteMany({
            user: userId,
            completed: false,
            title: new RegExp(`^Learn:\\s*${normalizedSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          });
        } catch (taskErr) {
          console.error('[LearningQueue] Failed to remove completed-skill planner task:', taskErr.message);
        }
      }
    }
    await profile.save();

    // Always run planner orchestration after queue mutation so Skill Gap queue
    // is reflected in the planner schedule with proper capacity/collision logic.
    setImmediate(async () => {
      try {
        await orchestrateDailyForUser({
          userId,
          trigger: `skill-queue-${action || 'update'}`,
        });
      } catch (e) {
        console.warn('[LearningQueue] Post-update orchestration failed:', e.message);
      }
    });

    res.json({ message: 'Learning queue updated', skillsToLearn: profile.skillsToLearn });
  } catch (err) {
    console.error('Learning queue error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /skills/gap-analysis (legacy) ───────────────────────────────────────
router.get('/gap-analysis', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  const profile = await StudentProfile.findOne({ userId: req.user.id });
  const targetRole = resolveTargetRole({ queryRole: req.query.role, profile, user });
  const cached = getCache(targetRole);
  if (cached) {
    return res.json({
      targetRole,
      matched: cached.matched_skills?.map(s => s.skill) || [],
      missing: cached.missing_skills?.map(s => s.skill) || [],
      matchScore: cached.overview?.match_score || 0,
    });
  }
  res.json({ targetRole, matched: [], missing: [], matchScore: 0, note: 'Run /analyze first' });
});

// ─── PUT /skills/update (legacy) ─────────────────────────────────────────────
router.put('/update', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { skills: req.body.skills }, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;