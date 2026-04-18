const router = require('express').Router();
const auth = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Task = require('../models/Task');
const axios = require('axios');

const ML_CACHE_TTL = 60 * 60 * 1000; // 1 hour

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
  const highPriority   = mlResult.high_priority_gaps   || mlResult.missing_skills?.slice(0, 5)  || [];
  const mediumPriority = mlResult.medium_priority_gaps || mlResult.missing_skills?.slice(5, 10) || [];
  const lowPriority    = mlResult.low_priority_gaps    || mlResult.missing_skills?.slice(10)    || [];

  const urgencyFor = (skill) => {
    const sl = skill.toLowerCase();
    if (highPriority.some(h => h.toLowerCase() === sl))   return 'Critical';
    if (mediumPriority.some(m => m.toLowerCase() === sl)) return 'High';
    return 'Medium';
  };

  // build missing skill objects with priorities
  const missingSkills = (mlResult.missing_skills || []).map((skill, i) => ({
    skill,
    urgency: urgencyFor(skill),
    priority_score: Math.max(40, 95 - i * 4),
    interview_frequency: Math.max(40, 92 - i * 4),
    time_to_proficiency_days: 20 + i * 5,
    prerequisites: [],
  }));

  // top priorities (high + medium combined, sorted by urgency)
  const urgencyOrder = { Critical: 0, High: 1, Medium: 2 };
  const topPriorities = [...missingSkills]
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
    .slice(0, 10);

  const matched = (mlResult.matched_skills || []).map(s => ({ skill: s, importance: 80 }));

  const matchScore = missingSkills.length === 0 && matched.length === 0
    ? 0
    : Math.round(mlResult.match_score || 0);

  const totalRequired = (mlResult.required_skills || []).length ||
    matched.length + missingSkills.length;

  const analysisText = matchScore >= 80
    ? `Great — you already cover ${matched.length} of ${totalRequired} skills required for ${mlResult.role}. Polish the remaining gaps to stand out.`
    : matchScore >= 60
    ? `Good progress! You cover ${matched.length} of ${totalRequired} required skills for ${mlResult.role}. Focusing on the Critical-priority gaps will significantly boost your readiness.`
    : matchScore >= 40
    ? `You have ${matched.length} of ${totalRequired} required skills for ${mlResult.role}. Build the Critical skills first — they appear most frequently in job postings.`
    : `Live job data shows ${totalRequired} key skills for ${mlResult.role}; you currently have ${matched.length} matched. Start with the top-priority skills immediately.`;

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
    required_skills: mlResult.required_skills || [],
    estimated_weeks: mlResult.estimated_weeks || 24,
    source: 'ml-scraper',
  };
}

// ─── GET /skills/analyze ───────────────────────────────────────────────────────
// Calls Python ML scraper (Naukri + LinkedIn + Claude) for any role.
// Results are cached 1 hour so subsequent loads are instant.
router.get('/analyze', auth, async (req, res) => {
  const userId = req.user.id;
  const queryRole = req.query.role;

  const profile = await StudentProfile.findOne({ userId }).catch(() => null);
  const user    = await User.findById(userId).catch(() => null);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const targetRole = queryRole || profile?.targetRole || user?.targetRole || 'Software Engineer';

  // Combine all user skills
  const allSkills = [
    ...(profile?.extractedSkills || []),
    ...(profile?.extraSkills     || []),
    ...(user?.skills             || []),
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
    const frontendData = mapMlToFrontend(mlResult, allSkills, profile);
    setCache(targetRole, frontendData);
    return res.json(frontendData);
  } catch (mlErr) {
    console.error('[SkillML] Python failed:', mlErr.message);
    return res.status(500).json({
      message: `ML scraper error: ${mlErr.message}`,
      details: 'Python skill_gap_analyzer.py failed. Check Python deps.',
    });
  }
});

// ─── GET /skills/ai-recommendation ───────────────────────────────────────────
// Returns role-specific AI action plan derived from ML analysis.
router.get('/ai-recommendation', auth, async (req, res) => {
  const userId    = req.user.id;
  const queryRole = req.query.role;

  const profile = await StudentProfile.findOne({ userId }).catch(() => null);
  const user    = await User.findById(userId).catch(() => null);

  const allSkills = [
    ...(profile?.extractedSkills || []),
    ...(profile?.extraSkills     || []),
    ...(user?.skills             || []),
  ].filter((s, i, a) => s && a.indexOf(s) === i);

  const targetRole = queryRole || profile?.targetRole || user?.targetRole || 'Software Engineer';

  // Try to use cached ML data to feed the recommendation
  const cached = getCache(targetRole);
  const missingSkills = cached?.missing_skills?.map(s => s.skill) || [];
  const highPriority  = cached?.top_5_priorities
    ?.filter(s => s.urgency === 'Critical')
    .map(s => s.skill) || missingSkills.slice(0, 3);
  const estimatedWeeks = cached?.estimated_weeks || 24;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const prompt = `Role: ${targetRole}. My skills: ${allSkills.join(', ') || 'None'}. Missing skills to learn: ${missingSkills.slice(0, 8).join(', ') || 'None'}. Provide a compact, actionable plan. Return ONLY JSON format matching exactly: { "analysis": "short assessment", "action_plan": [{"week": "1-2", "focus": "Topic", "action": "Details"}], "strengths": ["s1"], "weaknesses": ["w1"], "next_steps": ["step1"], "estimated_time_to_ready_weeks": 12 }`;
      const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      });
      let rawText = response.data.candidates[0].content.parts[0].text.trim();
      rawText = rawText.replace(/^```json/i, '').replace(/```$/, '').trim();
      const aiData = JSON.parse(rawText);
      return res.json({
        ...aiData,
        role: targetRole,
        source: 'gemini-ai'
      });
    } catch (e) {
      console.error('[SkillML] Gemini failed, falling back to local heuristic:', e.response?.data || e.message);
    }
  }

  const skillCount = allSkills.length;
  const analysis = skillCount >= 10
    ? `You have a solid base of ${skillCount} skills. For ${targetRole}, now deepen expertise in the scraped job-demand gaps and convert each into a demonstrable project or certification.`
    : skillCount >= 5
    ? `You have ${skillCount} skills documented. Live job data for ${targetRole} shows clear gaps — prioritize the Critical-tier skills and build project proof-of-work before applying.`
    : `You're in early stages with ${skillCount} skills. Live market data for ${targetRole} shows what hiring managers need — start with the top 3 Critical skills and build consistently.`;

  // Generate dynamic action plan from priorities
  const actionPlan = highPriority.length > 0
    ? [
        { week: '1–4',  focus: 'Foundation',      action: `Master ${highPriority[0] || 'core fundamentals'} — the #1 skill in live job postings for ${targetRole}` },
        { week: '5–8',  focus: 'Core Skills',     action: `Build ${highPriority[1] || 'key tools'} and create a project showcasing it on GitHub` },
        { week: '9–14', focus: 'Application',     action: `Apply ${highPriority[2] || 'domain knowledge'} in a real-world project or internship` },
        { week: '15–20',focus: 'Specialization',  action: `Deepen expertise in medium-priority skills and prepare a portfolio-quality project` },
        { week: '21–' + estimatedWeeks, focus: 'Interview Prep', action: `Practice ${targetRole} interview questions, refine your portfolio, and apply actively` },
      ]
    : [
        { week: '1–6',  focus: 'Foundation',  action: `Research and master core skills for ${targetRole} from live job listings` },
        { week: '7–14', focus: 'Practice',    action: 'Build hands-on projects demonstrating your skills' },
        { week: '15–' + estimatedWeeks, focus: 'Portfolio',   action: 'Polish your portfolio and apply to roles' },
      ];

  const nextSteps = highPriority.length > 0
    ? [
        `1. Start learning "${highPriority[0]}" immediately — it appears in the most job postings for ${targetRole}`,
        `2. Complete an online course or project on "${highPriority[1] || 'your next priority skill'}"`,
        '3. Build a project that combines your top 3 missing skills and publish it',
        `4. Search "${targetRole} jobs" on Naukri/LinkedIn and read 10 actual JDs`,
        '5. Update your resume to highlight matched skills, list in-progress skills',
      ]
    : [
        `1. Search live "${targetRole}" job postings on Naukri and LinkedIn`,
        '2. Identify the top 5 recurring skills in those JDs and start learning',
        '3. Build a hands-on project related to this role',
        '4. Connect with professionals in this field on LinkedIn',
        '5. Practice role-specific interview questions',
      ];

  const weaknesses = highPriority.slice(0, 3).map(s => `${s} (high demand in live job data)`);

  res.json({
    analysis,
    action_plan: actionPlan,
    strengths: allSkills.slice(0, 3),
    weaknesses: weaknesses.length ? weaknesses : [`Core ${targetRole} domain knowledge`, 'Real-world project experience'],
    next_steps: nextSteps,
    estimated_time_to_ready_weeks: estimatedWeeks,
    role: targetRole,
    source: cached ? 'ml-cache' : 'profile-only',
  });
});

// ─── GET /skills/learning-path ───────────────────────────────────────────────
// Kept for backward compatibility — returns minimal data
router.get('/learning-path', auth, async (req, res) => {
  const profile = await StudentProfile.findOne({ userId: req.user.id }).catch(() => null);
  const user    = await User.findById(req.user.id).catch(() => null);
  const targetRole = req.query.role || profile?.targetRole || user?.targetRole || 'Software Engineer';
  const cached     = getCache(targetRole);

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
      if (!profile.skillsToLearn) profile.skillsToLearn = [];
      if (!profile.skillsToLearn.includes(skill)) {
        profile.skillsToLearn.push(skill);
        // Append task to planner
        try {
          const today = new Date();
          await Task.create({
            user: userId,
            title: `Learn: ${skill}`,
            description: `Skill automatically added from Skill Gap Analyzer. Focus on learning ${skill} to improve candidate match score.`,
            date: today,
            startTime: '10:00',
            endTime: '11:00',
            duration: 3600,
            category: 'study',
            priority: 'high',
            aiGenerated: true
          });
        } catch (taskErr) {
          console.error('[LearningQueue] Failed to append task to planner:', taskErr.message);
        }
      }
    } else if (action === 'remove') {
      profile.skillsToLearn = (profile.skillsToLearn || []).filter(s => s !== skill);
    }
    await profile.save();
    res.json({ message: 'Learning queue updated', skillsToLearn: profile.skillsToLearn });
  } catch (err) {
    console.error('Learning queue error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /skills/gap-analysis (legacy) ───────────────────────────────────────
router.get('/gap-analysis', auth, async (req, res) => {
  const user    = await User.findById(req.user.id);
  const profile = await StudentProfile.findOne({ userId: req.user.id });
  const targetRole = req.query.role || profile?.targetRole || user?.targetRole || 'Software Engineer';
  const cached = getCache(targetRole);
  if (cached) {
    return res.json({
      targetRole,
      matched:    cached.matched_skills?.map(s => s.skill) || [],
      missing:    cached.missing_skills?.map(s => s.skill) || [],
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