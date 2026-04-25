const Task = require('../models/Task');
const BurnoutLog = require('../models/BurnoutLog');
const StudentProfile = require('../models/StudentProfile');
const AcademicEvent = require('../models/AcademicEvent');
const PlannerRunLog = require('../models/PlannerRunLog');

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

function modeTaskCap(mode) {
  if (mode === 'strict') return 7;
  if (mode === 'recovery') return 4;
  return 5;
}

function getSemesterTopics(semester = 1) {
  const roadmap = {
    1: ['Programming basics', 'Arrays & strings', 'Basic recursion'],
    2: ['Linked lists', 'Stacks & queues', 'Sorting + binary search'],
    3: ['Trees', 'BST', 'Hashing', 'Two pointers'],
    4: ['Graphs basics', 'Heaps', 'Greedy basics'],
    5: ['Dynamic programming I', 'Advanced graphs', 'Backtracking'],
    6: ['Dynamic programming II', 'Segment tree intro', 'Bit manipulation'],
    7: ['Interview problem sets', 'Systematic revision', 'Mock assessments'],
    8: ['Final revision sprint', 'Placement coding practice', 'Weak-topic patches'],
  };
  const sem = Math.max(1, Math.min(8, Number(semester) || 1));
  const current = roadmap[sem] || [];
  const revisions = sem >= 3 ? (roadmap[sem - 2] || []).slice(0, 2).map((v) => `${v} (revision)`) : [];
  return [...current, ...revisions];
}

async function createDsaTasks({ userId, profile, today, mode }) {
  const topics = getSemesterTopics(profile?.semester || 1);
  if (!topics.length) return 0;
  await Task.deleteMany({
    user: userId,
    aiGenerated: true,
    title: { $regex: /^DSA:/ },
    date: { $gte: today },
  });
  const startTime = profile?.plannerPreferences?.comfortableStart || '17:30';
  const durationMin = mode === 'recovery' ? 45 : mode === 'strict' ? 90 : 60;
  const payload = topics.slice(0, 6).map((topic, idx) => ({
    user: userId,
    title: `DSA: ${topic}`,
    description: 'Central orchestrator generated DSA block.',
    date: addDays(today, idx),
    startTime,
    duration: durationMin * 60,
    category: 'study',
    priority: idx < 2 ? 'high' : 'medium',
    aiGenerated: true,
    plannerMode: mode,
    movedByAgent: 'dsa-agent',
    movedReason: 'Daily centralized orchestration',
    explanation: 'DSA block created from semester-wise roadmap.',
  }));
  const created = await Task.insertMany(payload);
  return created.length;
}

async function createSyllabusTasks({ userId, profile, today, mode }) {
  const subjects = profile?.syllabusStructure?.subjects || [];
  if (!subjects.length) return 0;
  await Task.deleteMany({
    user: userId,
    aiGenerated: true,
    title: { $regex: /^Syllabus:/ },
    date: { $gte: today },
  });
  const concepts = [];
  for (const subject of subjects) {
    for (const chapter of subject?.chapters || []) {
      for (const topic of (chapter?.topics || []).slice(0, 2)) {
        concepts.push({
          subject: subject?.name || 'Subject',
          chapter: chapter?.name || 'Chapter',
          topic,
        });
        if (concepts.length >= 10) break;
      }
      if (concepts.length >= 10) break;
    }
    if (concepts.length >= 10) break;
  }
  if (!concepts.length) return 0;
  const startTime = profile?.plannerPreferences?.comfortableStart || '17:00';
  const durationMin = mode === 'recovery' ? 35 : 50;
  const tasks = concepts.map((item, idx) => {
    const subShort = String(item.subject || 'Subject').replace(/\s+/g, ' ').trim().slice(0, 48);
    return {
      user: userId,
      title: `Syllabus [${subShort}]: ${item.topic}`,
      description: `${item.subject} — ${item.chapter}`,
      date: addDays(today, idx),
      startTime,
      duration: durationMin * 60,
      category: 'study',
      priority: idx < 3 ? 'high' : 'medium',
      aiGenerated: true,
      plannerMode: mode,
      movedByAgent: 'syllabus-agent',
      movedReason: 'Daily centralized orchestration',
      explanation: 'Syllabus concept imported by centralized orchestrator.',
    };
  });
  const created = await Task.insertMany(tasks);
  return created.length;
}

async function orchestrateDailyForUser({ userId, trigger = 'manual' }) {
  const today = getTodayStart();
  const tomorrow = addDays(today, 1);
  const reasons = [];

  const [profile, latestBurnout, events] = await Promise.all([
    StudentProfile.findOne({ userId }),
    BurnoutLog.findOne({ userId }).sort({ date: -1 }).lean(),
    AcademicEvent.find({ userId, startDate: { $gte: today, $lte: addDays(today, 30) } }).lean(),
  ]);
  if (!profile) throw new Error('Student profile not found');

  const mode = profile?.planningMode || 'balanced';
  const burnoutLevel = latestBurnout?.burnoutLevel || 'Moderate';
  const burnoutScore = latestBurnout?.burnoutScore || 50;
  const highBurnout = ['High', 'Critical'].includes(burnoutLevel);
  const loadMultiplier = highBurnout ? 0.7 : 1;
  if (highBurnout) reasons.push('High burnout -> 30% load reduction');

  const cgpaLow = Number(profile?.cgpa || 0) > 0 && Number(profile?.cgpa || 0) < 7.5;
  if (cgpaLow) reasons.push('CGPA below 7.5 -> add academic reinforcement block');

  const hardEventToday = events.some((e) => ['Exam', 'SlipTest'].includes(e.type) && toIsoDate(e.startDate) === toIsoDate(today));
  if (hardEventToday) reasons.push('Hard exam/slip test constraint active today');

  const overdue = await Task.find({
    user: userId,
    completed: false,
    date: { $lt: today },
    rollovers: { $lt: 3 },
  }).sort({ date: 1, priority: -1 });

  for (const task of overdue) {
    task.date = tomorrow;
    task.rollovers = (task.rollovers || 0) + 1;
    task.priority = task.rollovers >= 2 ? 'high' : task.priority;
    task.movedByAgent = 'decision-engine';
    task.movedReason = 'Overdue task auto-shifted by centralized orchestrator';
    task.explanation = 'Incomplete task shifted to next day; repeated misses escalate priority.';
    await task.save();
  }

  const todayTasks = await Task.find({ user: userId, date: { $gte: today, $lt: tomorrow } }).sort({ priority: -1, startTime: 1 });
  const cap = Math.max(2, Math.round(modeTaskCap(mode) * loadMultiplier));
  let capacityShifted = 0;
  for (const task of todayTasks.slice(cap)) {
    if (task.completed) continue;
    task.date = tomorrow;
    task.rollovers = Math.min(3, (task.rollovers || 0) + 1);
    task.movedByAgent = 'planner-agent';
    task.movedReason = `Daily capacity exceeded for ${mode} mode`;
    task.explanation = 'Shifted by centralized orchestrator to maintain healthy daily load.';
    await task.save();
    capacityShifted += 1;
  }

  let cgpaBoostAdded = false;
  if (cgpaLow) {
    const existingBoost = await Task.findOne({
      user: userId,
      date: { $gte: today, $lt: tomorrow },
      title: 'Academic Reinforcement Block (90 min)',
    });
    if (!existingBoost) {
      await Task.create({
        user: userId,
        title: 'Academic Reinforcement Block (90 min)',
        description: 'Auto-added by centralized orchestrator due to CGPA threshold.',
        date: today,
        startTime: profile?.plannerPreferences?.comfortableStart || '17:00',
        duration: 90 * 60,
        category: 'study',
        priority: 'high',
        aiGenerated: true,
        plannerMode: mode,
        movedByAgent: 'goal-risk-agent',
        movedReason: 'CGPA below threshold',
        explanation: 'Added daily 90-minute support block for academic recovery.',
      });
      cgpaBoostAdded = true;
    }
  }

  const [dsaTasksCreated, syllabusTasksCreated] = await Promise.all([
    createDsaTasks({ userId, profile, today, mode }),
    createSyllabusTasks({ userId, profile, today, mode }),
  ]);

  const runLog = await PlannerRunLog.create({
    userId,
    runDate: new Date(),
    trigger,
    status: 'success',
    mode,
    burnout: {
      level: burnoutLevel,
      score: burnoutScore,
      loadMultiplier,
    },
    decisions: {
      overdueShifted: overdue.length,
      capacityShifted,
      dsaTasksCreated,
      syllabusTasksCreated,
      cgpaBoostAdded,
    },
    reasons,
    notes: 'Centralized orchestrator run completed.',
  });

  return {
    success: true,
    mode,
    burnoutLevel,
    burnoutScore,
    loadMultiplier,
    decisions: runLog.decisions,
    reasons,
    runLogId: runLog._id,
  };
}

module.exports = {
  orchestrateDailyForUser,
};
