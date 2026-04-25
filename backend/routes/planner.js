const router = require('express').Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const DynamicRoadmap = require('../models/DynamicRoadmap');
const axios = require('axios');
const StudentProfile = require('../models/StudentProfile');
const BurnoutLog = require('../models/BurnoutLog');
const PlannerRunLog = require('../models/PlannerRunLog');
const { orchestrateDailyForUser } = require('../services/centralPlannerOrchestrator');
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

function getTodayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getPerformanceRisk(performanceRating = '') {
  const scoreByRating = {
    Poor: 35,
    Fair: 20,
    Good: 8,
    Excellent: 0,
  };
  return scoreByRating[performanceRating] || 0;
}

function modeTaskCap(mode) {
  if (mode === 'strict') return 7;
  if (mode === 'recovery') return 4;
  return 5;
}

const DSA_ROADMAP_BY_SEM = {
  1: ['Programming basics', 'Arrays & strings', 'Basic recursion'],
  2: ['Linked lists', 'Stacks & queues', 'Sorting + binary search'],
  3: ['Trees', 'BST', 'Hashing', 'Two pointers'],
  4: ['Graphs basics', 'Heaps', 'Greedy basics'],
  5: ['Dynamic programming I', 'Advanced graphs', 'Backtracking'],
  6: ['Dynamic programming II', 'Segment tree intro', 'Bit manipulation'],
  7: ['Interview problem sets', 'Systematic revision', 'Mock assessments'],
  8: ['Final revision sprint', 'Placement coding practice', 'Weak-topic patches'],
};

function getSemesterTopics(semester = 1) {
  const sem = Math.max(1, Math.min(8, Number(semester) || 1));
  const current = DSA_ROADMAP_BY_SEM[sem] || [];
  const revisions = sem >= 3 ? (DSA_ROADMAP_BY_SEM[sem - 2] || []).slice(0, 2) : [];
  return { sem, current, revisions };
}

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

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function dayName(date) {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
}

function extractCollegeBlocksForDay(profile, date) {
  const timetable = profile?.timetable || {};
  const targetDay = dayName(date).toLowerCase();
  const blocks = [];

  // Supports shapes like:
  // timetable.grid = [{ day: 'Mon', start: '09:00', end: '16:00' }, ...]
  // timetable.days/timeSlots matrix can be added later.
  if (Array.isArray(timetable.grid)) {
    for (const row of timetable.grid) {
      const rowDay = String(row.day || row.weekday || '').slice(0, 3).toLowerCase();
      if (rowDay !== targetDay) continue;
      const start = parseTimeToMinutes(row.start || row.startTime, '09:00');
      const end = parseTimeToMinutes(row.end || row.endTime, '16:00');
      if (end > start) blocks.push({ start, end, source: 'college' });
    }
  }

  return blocks;
}

function buildDailyAvailability({ profile, date, events, examNear }) {
  const prefs = profile?.plannerPreferences || {};
  const wake = parseTimeToMinutes(prefs.wakeTime, '06:30');
  const sleep = parseTimeToMinutes(prefs.sleepTime, '23:00');
  const dinnerStart = parseTimeToMinutes(prefs.dinnerTime, '20:00');
  const dinnerEnd = Math.min(sleep, dinnerStart + 45);
  // Default to 7pm-11pm for college students (they study after college hours)
  const comfortableStart = parseTimeToMinutes(prefs.comfortableStart, '19:00');
  const comfortableEnd = parseTimeToMinutes(prefs.comfortableEnd, '23:00');
  const isWeekend = [0, 6].includes(new Date(date).getDay());
  const isSunday = new Date(date).getDay() === 0;
  const weekendHoliday = prefs.weekendHoliday !== false;
  const dateIso = toIsoDate(date);
  const holidayToday = events.some((e) => e.type === 'Holiday' && toIsoDate(e.startDate) === dateIso);

  const blocked = [];
  blocked.push({ start: dinnerStart, end: dinnerEnd, source: 'dinner' });

  // Sunday / weekend enrichment rule — full window open for enrichment activities
  if (isSunday && weekendHoliday && !examNear) {
    return {
      wake,
      sleep,
      // Full evening available for enrichment (10am to 10pm on Sunday)
      availability: [{ start: Math.max(wake, 10 * 60), end: Math.min(sleep, 22 * 60), source: 'sunday-enrichment' }],
      blocked,
      policy: 'sunday-enrichment',
      holidayToday: false,
      isSunday: true,
    };
  }

  // Saturday half-day rule
  if (isWeekend && !isSunday && weekendHoliday && !examNear) {
    return {
      wake,
      sleep,
      availability: [{ start: comfortableStart, end: Math.min(comfortableStart + 120, comfortableEnd), source: 'essential' }],
      blocked,
      policy: 'weekend-holiday-essential-only',
      holidayToday: false,
    };
  }

  // Holiday: full-day planning is allowed (even during college hours)
  if (holidayToday) {
    return {
      wake,
      sleep,
      availability: [{ start: wake, end: sleep, source: 'holiday-full-day' }],
      blocked,
      policy: examNear ? 'holiday-full-day-exam-priority' : 'holiday-full-day',
      holidayToday: true,
    };
  }

  // Regular day: prioritize non-college comfortable window
  const collegeBlocks = extractCollegeBlocksForDay(profile, date);
  blocked.push(...collegeBlocks);

  const windows = [{ start: comfortableStart, end: comfortableEnd, source: 'comfort-window' }];
  const availability = [];
  for (const win of windows) {
    let segments = [{ start: win.start, end: win.end, source: win.source }];
    for (const b of blocked) {
      const next = [];
      for (const seg of segments) {
        if (!overlaps(seg.start, seg.end, b.start, b.end)) {
          next.push(seg);
          continue;
        }
        if (b.start > seg.start) next.push({ ...seg, end: b.start });
        if (b.end < seg.end) next.push({ ...seg, start: b.end });
      }
      segments = next;
    }
    availability.push(...segments.filter((s) => s.end - s.start >= 25));
  }

  return {
    wake,
    sleep,
    availability,
    blocked,
    policy: 'non-college-comfort-window',
    holidayToday: false,
  };
}

router.get('/', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { user: req.user.id };
    if (start && end) query.date = { $gte: new Date(start), $lte: new Date(end) };
    const tasks = await Task.find(query).sort('date startTime');
    res.json(tasks);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, user: req.user.id });
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/preferences/constants', auth, async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user.id }).lean();
    res.json({
      planningMode: profile?.planningMode || 'balanced',
      plannerPreferences: profile?.plannerPreferences || null,
      cgpa: profile?.cgpa ?? null,
      semester: profile?.semester ?? null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/preferences/constants', auth, async (req, res) => {
  try {
    const {
      planningMode,
      wakeTime,
      sleepTime,
      dinnerTime,
      comfortableStart,
      comfortableEnd,
      hobbies,
      weekendHoliday,
      holidayEssentialTasks,
    } = req.body || {};

    const updates = {};
    if (planningMode) updates.planningMode = planningMode;
    updates.plannerPreferences = {
      wakeTime: wakeTime || '06:30',
      sleepTime: sleepTime || '23:00',
      dinnerTime: dinnerTime || '20:00',
      // Default to 7pm-11pm — college student window (after college hours)
      comfortableStart: comfortableStart || '19:00',
      comfortableEnd: comfortableEnd || '23:00',
      hobbies: Array.isArray(hobbies) ? hobbies : [],
      weekendHoliday: weekendHoliday !== false,
      holidayEssentialTasks: Array.isArray(holidayEssentialTasks) ? holidayEssentialTasks : ['light revision'],
    };

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates, $setOnInsert: { userId: req.user.id } },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      success: true,
      planningMode: profile.planningMode,
      plannerPreferences: profile.plannerPreferences,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body, { new: true }
    );
    res.json(task);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/status', auth, async (req, res) => {
  try {
    const { completed, reasonText = '' } = req.body || {};
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        completed: !!completed,
        completionReason: reasonText,
      },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Task deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/ai-generate', auth, async (req, res) => {
  try {
    const { subjects, examDate, hoursPerDay } = req.body;
    // Generate AI study plan logic
    const days = Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));
    const tasks = [];
    subjects.forEach((subject, i) => {
      for (let d = 0; d < days; d++) {
        const date = new Date();
        date.setDate(date.getDate() + d);
        if (d % subjects.length === i) {
          tasks.push({
            user: req.user.id,
            title: `Study: ${subject}`,
            date,
            startTime: '09:00',
            endTime: `${9 + Math.min(hoursPerDay, 3)}:00`,
            category: 'study',
            priority: d < 2 ? 'high' : 'medium',
            aiGenerated: true
          });
        }
      }
    });
    const created = await Task.insertMany(tasks);
    res.json(created);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post('/sync-roadmap', auth, async (req, res) => {
  try {
    let { role } = req.body || {};
    // Always fetch profile (we need it for prefs)
    const profileDoc = await StudentProfile.findOne({ userId: req.user.id }).lean();
    if (!role) {
      role = profileDoc?.targetRole || (Array.isArray(profileDoc?.targetRoles) && profileDoc.targetRoles[0]) || '';
    }
    if (!role) {
      return res.status(400).json({ message: 'No target role. Set target role in Profile or pass role in the request body.' });
    }

    let roadmap = await DynamicRoadmap.findOne({ role }).catch(() => null);
    if (!roadmap) {
      roadmap = await DynamicRoadmap.findOne({ role: new RegExp(`^${escapeRegex(role)}$`, 'i') });
    }
    if (!roadmap || !roadmap.semesters?.length) {
      return res.status(404).json({
        message: 'No roadmap in database for this role yet. Open Career Roadmap once (same role) to generate and save it, then try again.',
        role,
      });
    }
    
    // 2. Get existing tasks to avoid conflicts
    const today = new Date();
    today.setHours(0,0,0,0);
    const existingTasks = await Task.find({ user: req.user.id, date: { $gte: today } });
    
    // 3. User Prefs (for burnout model)
    const userPrefs = {
        max_study_hours: 4,
        sleep_hours: req.user.sleepHours || 7,
        academic_load: 5,
        deadline_pressure: 5
    };
    
    // 4. Send to Python Agent (optional — fallback keeps planner usable without ML)
    let mlRes;
    try {
      mlRes = await axios.post(`${ML_URL}/reschedule`, {
        phases: roadmap.semesters,
        existing_tasks: existingTasks,
        user_prefs: userPrefs,
      }, { timeout: 120000 });
    } catch (mlErr) {
      console.warn('[sync-roadmap] ML reschedule failed, using Node fallback:', mlErr.message);
      mlRes = { data: null };
    }

    if (mlRes.data && mlRes.data.tasks?.length) {
      await Task.deleteMany({
        user: req.user.id,
        date: { $gte: today },
        aiGenerated: true,
        title: { $regex: /^Roadmap:/ },
      });

      const newTasks = mlRes.data.tasks.map((t) => ({
        ...t,
        user: req.user.id,
        date: new Date(t.date),
      }));

      const created = await Task.insertMany(newTasks);
      return res.json({ source: 'ml', tasks: created });
    }

    // Fallback: one Roadmap task per upcoming semester block (no Python required)
    // Use user's preferred study start time (defaults to 7pm for college students)
    const preferredStart = profileDoc?.plannerPreferences?.comfortableStart || '19:00';
    await Task.deleteMany({
      user: req.user.id,
      date: { $gte: today },
      aiGenerated: true,
      title: { $regex: /^Roadmap:/ },
    });
    const fallbackPayload = [];
    roadmap.semesters.slice(0, 8).forEach((sem, idx) => {
      const d = new Date(today);
      d.setDate(d.getDate() + idx * 2);
      const title = sem.title ? `Roadmap: ${sem.title}` : `Roadmap: Semester ${sem.sem || idx + 1}`;
      const firstTask = Array.isArray(sem.tasks) && sem.tasks[0] ? sem.tasks[0] : (sem.skills && sem.skills[0]) || `Progress ${title}`;
      fallbackPayload.push({
        user: req.user.id,
        title,
        description: String(firstTask).slice(0, 500),
        date: d,
        startTime: preferredStart,
        endTime: '',
        duration: 90 * 60,
        category: 'study',
        priority: idx < 2 ? 'high' : 'medium',
        aiGenerated: true,
        movedByAgent: 'planner-fallback',
        movedReason: 'ML /reschedule unavailable — generated from saved Mongo roadmap',
        explanation: 'Open Career Roadmap once to refresh scraped phases; tasks come from stored roadmap.',
      });
    });
    const created = await Task.insertMany(fallbackPayload);
    return res.json({ source: 'mongo-roadmap-fallback', tasks: created, warning: 'ML service did not return tasks; used saved roadmap only.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

const AcademicEvent = require('../models/AcademicEvent');

// ─── NEW: POST /calendar ──────────────────────────────────────────────────────
router.post('/calendar', auth, async (req, res) => {
  try {
    const events = req.body.events.map(event => ({
      ...event,
      userId: req.user.id,
      // Compute endDate if single-day
      endDate: event.endDate || new Date(new Date(event.startDate).getTime() + 24*60*60*1000)
    }));
    const created = await AcademicEvent.insertMany(events);
    res.json({ success: true, created: created.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /calendar-events ─────────────────────────────────────────────────────
router.get('/calendar-events', auth, async (req, res) => {
  try {
    const events = await AcademicEvent.find({ userId: req.user.id })
      .sort({ startDate: 1 })
      .lean();

    const normalized = events.map((event) => ({
      _id: event._id,
      type: event.type || 'Event',
      date: event.startDate || event.date,
      startDate: event.startDate,
      endDate: event.endDate,
    }));

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/risk', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayStart();
    const fourteenDaysAgo = addDays(today, -14);
    const [latestBurnout, recentTasks, profile] = await Promise.all([
      BurnoutLog.findOne({ userId }).sort({ date: -1 }).lean(),
      Task.find({ user: userId, date: { $gte: fourteenDaysAgo, $lte: today } }).lean(),
      StudentProfile.findOne({ userId }).lean(),
    ]);

    const total = recentTasks.length;
    const done = recentTasks.filter((t) => t.completed).length;
    const completionRate = total ? done / total : 1;
    const deadlineMisses = recentTasks.filter((t) => !t.completed && new Date(t.date) < today).length;
    const burnoutScore = latestBurnout?.burnoutScore || 45;
    const perfRisk = getPerformanceRisk(latestBurnout?.performanceRating);
    const executionRisk = Math.round((1 - completionRate) * 35 + Math.min(20, deadlineMisses * 4));
    const cgpaRisk = profile?.cgpa != null && profile.cgpa < 7.5 ? 15 : 0;
    const riskScore = Math.min(100, burnoutScore * 0.45 + executionRisk + perfRisk + cgpaRisk);

    const reasons = [];
    if (burnoutScore >= 65) reasons.push('Burnout trend is high');
    if (completionRate < 0.6) reasons.push('Task completion has dropped');
    if (deadlineMisses >= 3) reasons.push('Frequent overdue tasks detected');
    if (cgpaRisk) reasons.push('CGPA is below 7.5, academics need extra time');

    res.json({
      riskScore: Math.round(riskScore),
      riskLevel: riskScore >= 75 ? 'high' : riskScore >= 50 ? 'medium' : 'low',
      completionRate: Math.round(completionRate * 100),
      reasons,
      mode: profile?.planningMode || 'balanced',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/daily-replan', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayStart();
    const tomorrow = addDays(today, 1);

    const [profile, latestBurnout, upcomingEvents] = await Promise.all([
      StudentProfile.findOne({ userId }),
      BurnoutLog.findOne({ userId }).sort({ date: -1 }).lean(),
      AcademicEvent.find({ userId, startDate: { $gte: today, $lte: addDays(today, 30) } }).lean(),
    ]);

    const mode = profile?.planningMode || 'balanced';
    const burnoutLevel = latestBurnout?.burnoutLevel || 'Moderate';
    const highBurnout = ['High', 'Critical'].includes(burnoutLevel);
    const loadMultiplier = highBurnout ? 0.7 : 1;
    const profileCgpa = Number(profile?.cgpa || 0);
    const shouldAddAcademicBoost = profileCgpa > 0 && profileCgpa < 7.5;

    const overdue = await Task.find({
      user: userId,
      completed: false,
      date: { $lt: today },
      rollovers: { $lt: 3 },
    }).sort({ date: 1, priority: -1 });

    const updates = [];
    for (const task of overdue) {
      task.date = tomorrow;
      task.rollovers = (task.rollovers || 0) + 1;
      task.priority = task.rollovers >= 2 ? 'high' : task.priority;
      task.movedByAgent = 'planner';
      task.movedReason = 'Task incomplete, auto-shifted by daily planner.';
      task.explanation = 'Missed task shifted to next day; repeated misses increase priority.';
      updates.push(task.save());
    }
    await Promise.all(updates);

    const todayTasks = await Task.find({ user: userId, date: { $gte: today, $lt: tomorrow } }).sort({ startTime: 1 });
    const hardEventDates = new Set(
      upcomingEvents
        .filter((event) => ['Exam', 'SlipTest'].includes(event.type))
        .map((event) => toIsoDate(event.startDate))
    );
    const todayIso = toIsoDate(today);
    const taskCap = modeTaskCap(mode);

    let adjusted = todayTasks;
    const explanationLog = [];

    if (hardEventDates.has(todayIso)) {
      adjusted = adjusted.map((task) => ({
        ...task.toObject(),
        movedByAgent: task.movedByAgent || 'calendar-agent',
        explanation: task.explanation || 'Hard academic event day detected: focus shifted to exam-critical tasks.',
      }));
      explanationLog.push('Exam/slip test day is treated as hard constraint.');
    }

    if (highBurnout && adjusted.length > taskCap) {
      adjusted = adjusted.slice(0, taskCap);
      explanationLog.push('High burnout detected, daily plan reduced by 30%.');
    }

    if (shouldAddAcademicBoost) {
      const boostTask = await Task.create({
        user: userId,
        title: 'Academic Reinforcement Block (90 min)',
        description: 'Auto-added because CGPA is below 7.5.',
        date: today,
        startTime: profile?.plannerPreferences?.comfortableStart || '17:00',
        endTime: '',
        duration: 90 * 60,
        category: 'study',
        priority: 'high',
        aiGenerated: true,
        plannerMode: mode,
        movedByAgent: 'goal-risk-agent',
        movedReason: 'CGPA below threshold',
        explanation: 'Added daily 90-minute academic block to improve academic performance.',
      });
      adjusted.push(boostTask.toObject());
      explanationLog.push('CGPA below 7.5, added 90-minute academic support block.');
    }

    const overflow = todayTasks.slice(taskCap);
    for (const task of overflow) {
      if (task.completed) continue;
      task.date = tomorrow;
      task.rollovers = Math.min(3, (task.rollovers || 0) + 1);
      task.movedByAgent = 'planner';
      task.movedReason = 'Daily capacity cap reached';
      task.explanation = `Moved to maintain ${mode} mode daily capacity.`;
      await task.save();
    }

    if (latestBurnout?._id) {
      await BurnoutLog.updateOne(
        { _id: latestBurnout._id },
        {
          $set: {
            plannerDecision: {
              mode,
              loadMultiplier,
              explanation: explanationLog.join(' '),
            },
          },
        }
      );
    }

    res.json({
      success: true,
      mode,
      burnoutLevel,
      loadMultiplier,
      shiftedTasks: overdue.length + overflow.length,
      explanationLog,
      totalTodayTasks: adjusted.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/timetable/generate', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Math.max(1, Math.min(14, Number(req.body?.days) || 7));
    const profile = await StudentProfile.findOne({ userId }).lean();
    if (!profile) return res.status(400).json({ message: 'Profile not found. Please complete onboarding/preferences.' });

    const today = getTodayStart();
    const end = addDays(today, days);
    const [tasks, events, latestBurnout] = await Promise.all([
      Task.find({ user: userId, date: { $gte: today, $lt: end }, completed: false }).sort({ priority: -1, date: 1 }).lean(),
      AcademicEvent.find({ userId, startDate: { $gte: today, $lt: end } }).lean(),
      BurnoutLog.findOne({ userId }).sort({ date: -1 }).lean(),
    ]);

    const riskHigh = ['High', 'Critical'].includes(latestBurnout?.burnoutLevel || '');
    const mode = profile?.planningMode || 'balanced';
    const multiplier = riskHigh ? 0.7 : 1;
    const dailyPlan = [];
    const unscheduled = [];
    const examDates = new Set(events.filter((e) => ['Exam', 'SlipTest'].includes(e.type)).map((e) => toIsoDate(e.startDate)));

    const SUNDAY_ENRICHMENT_SLOTS = [
      { start: 10 * 60,       duration: 60,  title: '🎯 LeetCode / DSA Practice',      category: 'coding',   explanation: 'Sunday coding practice — consistent DSA builds interview skills.' },
      { start: 11 * 60 + 15, duration: 60,  title: '📚 Skill Building (Udemy/YT)',     category: 'learning', explanation: 'Dedicate 1 hr to an online course or tutorial of your choice.' },
      { start: 14 * 60,      duration: 90,  title: '🚀 Side Project / Portfolio',      category: 'project',  explanation: 'Build something for your portfolio — weekends are perfect for this.' },
      { start: 16 * 60,      duration: 120, title: '🎨 Hobby Time (2 hrs)',            category: 'hobby',    explanation: 'Protected hobby time — recharge for the week ahead.' },
      { start: 19 * 60,      duration: 60,  title: '🧠 Learn Something New',           category: 'learning', explanation: 'Read an article, watch a tech talk, or explore a concept.' },
      { start: 20 * 60 + 30, duration: 45,  title: '📝 Weekly Plan Review',           category: 'personal', explanation: 'Review next week\'s goals and priorities before the week starts.' },
    ];

    const HOLIDAY_ENRICHMENT_SLOTS = [
      { start: 10 * 60,       duration: 60,  title: '🎯 LeetCode Practice',            category: 'coding',   explanation: 'Holiday — great time for consistent DSA practice.' },
      { start: 11 * 60 + 15, duration: 60,  title: '📚 Skill Up',                     category: 'learning', explanation: 'Learn something new — online course or documentation.' },
      { start: 14 * 60,      duration: 90,  title: '🔨 Project Work',                 category: 'project',  explanation: 'Use this holiday to make progress on a side project.' },
      { start: 16 * 60,      duration: 120, title: '🎨 Hobby & Relaxation (2 hrs)',   category: 'hobby',    explanation: 'Rest and enjoy your holiday — 2 hrs of free hobby time.' },
    ];

    for (let d = 0; d < days; d += 1) {
      const date = addDays(today, d);
      const dateIso = toIsoDate(date);
      const examNear = [0, 1, 2].some((n) => examDates.has(toIsoDate(addDays(date, n))));
      const availability_result = buildDailyAvailability({
        profile,
        date,
        events,
        examNear,
      });
      const { availability, blocked, policy, holidayToday, isSunday } = availability_result;

      const dayTasks = tasks.filter((t) => toIsoDate(t.date) === dateIso);
      const cap = Math.max(2, Math.round(modeTaskCap(mode) * multiplier));
      const selected = dayTasks.slice(0, cap);
      const timeline = [];

      // Add blocked blocks first (for UI clarity)
      blocked.forEach((b) => {
        timeline.push({
          type: 'blocked',
          title: b.source === 'college' ? 'College hours' : 'Routine block',
          startTime: minutesToTime(b.start),
          endTime: minutesToTime(b.end),
          source: b.source,
        });
      });

      // --- Sunday enrichment: fill with curated activities ---
      if (isSunday && !examNear) {
        const userHobbies = profile?.plannerPreferences?.hobbies || [];
        SUNDAY_ENRICHMENT_SLOTS.forEach((slot) => {
          const slotTitle = slot.category === 'hobby' && userHobbies.length
            ? `🎨 Hobby: ${userHobbies.join(' / ')} (2 hrs)`
            : slot.title;
          timeline.push({
            type: 'enrichment',
            title: slotTitle,
            category: slot.category,
            startTime: minutesToTime(slot.start),
            endTime: minutesToTime(slot.start + slot.duration),
            priority: 'low',
            explanation: slot.explanation,
          });
        });
        dailyPlan.push({
          date: dateIso,
          mode,
          policy,
          holidayToday: false,
          isSunday: true,
          riskHigh,
          timeline: timeline.sort((a, b) => a.startTime.localeCompare(b.startTime)),
        });
        continue;
      }

      // --- Holiday enrichment: fill with curated activities ---
      if (holidayToday && !examNear) {
        const userHobbies = profile?.plannerPreferences?.hobbies || [];
        // First schedule any actual user tasks  
        let windowIdx = 0;
        let cursor = availability[0]?.start || null;
        selected.slice(0, 2).forEach((task) => {
          const duration = Math.max(30, Math.round(((task.duration || 3600) / 60) * multiplier));
          while (windowIdx < availability.length && cursor != null && cursor + duration > availability[windowIdx].end) {
            windowIdx += 1;
            cursor = availability[windowIdx]?.start ?? null;
          }
          if (cursor == null) { unscheduled.push(task._id); return; }
          const start = cursor;
          const endTime = Math.min(availability[windowIdx].end, start + duration);
          timeline.push({
            type: 'task', taskId: task._id, title: task.title, category: task.category,
            startTime: minutesToTime(start), endTime: minutesToTime(endTime),
            priority: task.priority, explanation: task.explanation || 'Placed in holiday availability window.',
          });
          cursor = endTime + 10;
        });
        // Then fill enrichment slots
        HOLIDAY_ENRICHMENT_SLOTS.forEach((slot) => {
          const slotTitle = slot.category === 'hobby' && userHobbies.length
            ? `🎨 Hobby: ${userHobbies.join(' / ')} (2 hrs)` : slot.title;
          timeline.push({
            type: 'enrichment', title: slotTitle, category: slot.category,
            startTime: minutesToTime(slot.start), endTime: minutesToTime(slot.start + slot.duration),
            priority: 'low', explanation: slot.explanation,
          });
        });
        dailyPlan.push({
          date: dateIso, mode, policy, holidayToday: true, riskHigh,
          timeline: timeline.sort((a, b) => a.startTime.localeCompare(b.startTime)),
        });
        continue;
      }

      // --- Regular day scheduling ---
      let windowIdx = 0;
      let cursor = availability[0]?.start || null;
      selected.forEach((task) => {
        const duration = Math.max(30, Math.round(((task.duration || 3600) / 60) * multiplier));
        while (windowIdx < availability.length && cursor != null && cursor + duration > availability[windowIdx].end) {
          windowIdx += 1;
          cursor = availability[windowIdx]?.start ?? null;
        }
        if (cursor == null) {
          unscheduled.push(task._id);
          return;
        }
        const start = cursor;
        const endTime = Math.min(availability[windowIdx].end, start + duration);
        timeline.push({
          type: 'task',
          taskId: task._id,
          title: task.title,
          category: task.category,
          startTime: minutesToTime(start),
          endTime: minutesToTime(endTime),
          priority: task.priority,
          explanation: task.explanation || 'Placed in available non-college comfort window.',
        });
        cursor = endTime + 10; // keep a short break
      });

      // Optional hobby block
      const hobbies = profile?.plannerPreferences?.hobbies || [];
      if (hobbies.length && availability.length) {
        const lastWindow = availability[availability.length - 1];
        const hobbyStart = Math.max(lastWindow.start, lastWindow.end - 45);
        timeline.push({
          type: 'hobby',
          title: `🎨 Hobby: ${hobbies[0]}`,
          startTime: minutesToTime(hobbyStart),
          endTime: minutesToTime(Math.min(lastWindow.end, hobbyStart + 35)),
          explanation: 'Added from stored hobby preference for schedule balance.',
        });
      }

      dailyPlan.push({
        date: dateIso,
        mode,
        policy,
        holidayToday,
        riskHigh,
        timeline: timeline.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      });
    }

    res.json({
      success: true,
      mode,
      multiplier,
      days,
      dailyPlan,
      unscheduledCount: unscheduled.length,
      explainability: {
        burnoutAdjustment: riskHigh ? 'High burnout detected: 30% load reduction applied.' : 'No burnout reduction applied.',
        cgpaRule: profile?.cgpa != null && profile.cgpa < 7.5 ? 'CGPA below 7.5: academic reinforcement remains active.' : 'CGPA reinforcement not active.',
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/orchestrate-daily', auth, async (req, res) => {
  try {
    const result = await orchestrateDailyForUser({
      userId: req.user.id,
      trigger: 'manual',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/orchestration-runs', auth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(30, Number(req.query.limit) || 10));
    const runs = await PlannerRunLog.find({ userId: req.user.id })
      .sort({ runDate: -1 })
      .limit(limit)
      .lean();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/dsa/sync', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await StudentProfile.findOne({ userId }).lean();
    const today = getTodayStart();
    const { sem, current, revisions } = getSemesterTopics(profile?.semester || 1);
    const mode = profile?.planningMode || 'balanced';

    await Task.deleteMany({
      user: userId,
      aiGenerated: true,
      category: 'study',
      title: { $regex: /^DSA:/ },
      date: { $gte: today },
    });

    const baseStart = profile?.plannerPreferences?.comfortableStart || '19:00';
    const durationMin = mode === 'recovery' ? 45 : mode === 'strict' ? 90 : 60;
    const payload = [];
    const combined = [...current, ...revisions.map((r) => `${r} (revision)`)];

    combined.forEach((topic, idx) => {
      const date = addDays(today, idx);
      payload.push({
        user: userId,
        title: `DSA: ${topic}`,
        description: `Semester ${sem} DSA roadmap auto-scheduled task.`,
        date,
        startTime: baseStart,
        endTime: '',
        duration: durationMin * 60,
        category: 'study',
        priority: idx < 2 ? 'high' : 'medium',
        completed: false,
        aiGenerated: true,
        plannerMode: mode,
        movedByAgent: 'dsa-agent',
        movedReason: 'Semester-wise DSA roadmap sync',
        explanation: `Generated from semester ${sem} DSA roadmap with revision reinforcement.`,
      });
    });

    const created = await Task.insertMany(payload);
    res.json({
      success: true,
      semester: sem,
      tasksCreated: created.length,
      topics: combined,
      mode,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/syllabus/sync', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await StudentProfile.findOne({ userId }).lean();
    const today = getTodayStart();
    const mode = profile?.planningMode || 'balanced';

    const subjects = profile?.syllabusStructure?.subjects || [];
    if (!subjects.length) {
      return res.status(400).json({ message: 'No parsed syllabus found. Please upload/parse syllabus first.' });
    }

    await Task.deleteMany({
      user: userId,
      aiGenerated: true,
      category: 'study',
      title: { $regex: /^Syllabus:/ },
      date: { $gte: today },
    });

    const cap = req.body?.limit && Number(req.body.limit) > 0 ? Math.min(25, Number(req.body.limit)) : 12;
    const extracted = [];
    for (const subject of subjects) {
      const subName = subject?.name || 'Subject';
      const chapters = subject?.chapters || [];
      for (const chapter of chapters) {
        const topics = (chapter?.topics || []).slice(0, 3);
        for (const topic of topics) {
          extracted.push({
            subject: subName,
            chapter: chapter?.name || 'Core Concepts',
            topic,
          });
          if (extracted.length >= cap) break;
        }
        if (extracted.length >= cap) break;
      }
      if (extracted.length >= cap) break;
    }

    const baseStart = profile?.plannerPreferences?.comfortableStart || '17:00';
    const intervalDays = mode === 'strict' ? 0 : 1;
    const durationMin = mode === 'recovery' ? 35 : 50;

    const tasks = extracted.map((item, idx) => {
      const subShort = String(item.subject || 'Subject').replace(/\s+/g, ' ').trim().slice(0, 48);
      return {
      user: userId,
      title: `Syllabus [${subShort}]: ${item.topic}`,
      description: `${item.subject} — ${item.chapter}`,
      date: addDays(today, idx * intervalDays),
      startTime: baseStart,
      endTime: '',
      duration: durationMin * 60,
      category: 'study',
      priority: idx < 3 ? 'high' : 'medium',
      completed: false,
      aiGenerated: true,
      plannerMode: mode,
      movedByAgent: 'syllabus-agent',
      movedReason: 'Imported from parsed syllabus',
      explanation: 'Syllabus concept imported and converted into a planner task.',
    };
    });

    const created = await Task.insertMany(tasks);
    res.json({
      success: true,
      tasksCreated: created.length,
      importedConcepts: extracted.length,
      mode,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── NEW: POST /agent-reschedule (roll-overs + agentic) ───────────────────────
router.post('/agent-reschedule', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch context
    const today = new Date(); today.setHours(0,0,0,0);
    const undone = await Task.find({
      user: userId,
      completed: false,
      date: { $lt: today }, // Overdue
      rollovers: { $lt: 3 } // Max 3
    }).sort({ date: 1 }).limit(10);
    
    // Roll-over logic
    const rollOvers = undone.map(task => {
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      task.date = tomorrow;
      task.rollovers = (task.rollovers || 0) + 1;
      task.priority = task.rollovers > 1 ? 'high' : task.priority; // Escalate
      return task;
    });
    
    await Task.bulkSave(rollOvers); // Note: Use bulkWrite for efficiency
    
    // Agent re-optimize (call Python orchestrator)
    const profile = await StudentProfile.findOne({ userId });
    const roadmap = await DynamicRoadmap.findOne({ role: profile?.targetRole });
    const events = await AcademicEvent.find({ userId, startDate: { $gte: today } });
    
    const mlRes = await axios.post(`${ML_URL}/orchestrate`, {
      userId,
      overdueCount: undone.length,
      events: events.map(e => ({ startDate: e.startDate, type: e.type })),
      phases: roadmap?.semesters || [],
      trigger: 'rollover'
    });
    
    // Apply ML updates (similar to sync-roadmap)
    if (mlRes.data.tasks) {
      await Task.deleteMany({ user: userId, date: { $gte: today }, aiGenerated: true });
      const newTasks = mlRes.data.tasks.map(t => ({ ...t, user: userId }));
      await Task.insertMany(newTasks);
    }
    
    res.json({
      rollOvers: rollOvers.length,
      newTasks: mlRes.data.tasks?.length || 0,
      summary: mlRes.data.summary || 'Rescheduled complete'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
