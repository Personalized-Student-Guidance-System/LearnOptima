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

function modeTaskCap(mode, isWeekend = false) {
  const base = mode === 'strict' ? 8 : mode === 'recovery' ? 3 : 5;
  return isWeekend ? base + 3 : base; // weekends absorb more tasks
}

// ── 4-Year DSA Roadmap (week-labelled, per-semester) ─────────────────────────
const DSA_WEEKLY_PLAN = {
  1: [
    'Wk1: Time & Space Complexity (Big-O) — factorial, fibonacci, recursion trees',
    'Wk1: Recursion basics — recursion trees, stack trace',
    'Wk2: Arrays: Traversal & Prefix Sum — max subarray, leaders in array',
    'Wk2: Arrays: Kadane\'s Algorithm — max subarray sum, move zeros',
    'Wk3: Arrays: Leaders & Move zeros — sliding window intro',
    'Wk4: Strings: Basics + hashing — anagrams, palindrome logic',
    'Wk4: Strings: Anagrams & Palindrome — longest palindrome, valid anagram',
    'Wk5: Sorting: Bubble/Selection/Insertion — stability, comparison',
    'Wk6: Sorting: Merge Sort — why O(n log n), implementation',
    'Wk6: Sorting: Quick Sort — partition logic, variants',
    'Wk7: Binary Search: Standard + Lower/Upper bound — search in sorted array',
    'Wk8: Binary Search: Rotated array — peak element, rotated search',
    'Wk9: 2D Arrays: Matrix traversal & Spiral — spiral matrix, diagonal',
    'Wk10: 2D Arrays: Diagonal & rotation — matrix rotation, transpose',
    'Wk11-12: Revision Sprint: Arrays + Strings + Sorting — LeetCode 10 easy',
    'Wk13: Mini Contest: Mixed Topics — Codeforces Div3',
    'Wk14-15: Platform Practice: LeetCode Easy (10 problems)',
    'Wk16: Semester Wrap-up — cheat sheet, pattern summary',
  ],
  2: [
    'Wk1: Linked List: Reverse & basics — reverse LL, detect middle',
    'Wk2: Linked List: Cycle detection (Floyd) — Floyd\'s algorithm',
    'Wk3: Linked List: Merge sorted lists — merge two sorted LL',
    'Wk4: Stack: Using array & LL — valid parentheses, next greater element',
    'Wk5: Queue: Basics & circular queue — BFS using queue',
    'Wk5: Monotonic Stack intro — next greater element, stock span',
    'Wk6: Monotonic Stack: Problems — largest histogram, rain water',
    'Wk7: Recursion: Subsets & power set — generate subsets',
    'Wk8: Backtracking: Permutations — all permutations, letter combinations',
    'Wk9: Backtracking: N-Queens — N-Queens solver, rat in maze',
    'Wk10: Hashing: Maps, sets, frequency-based — two sum, frequency count',
    'Wk11: Hashing: Sliding window + hash map — longest unique substr',
    'Wk12-13: Mixed Practice: LL + Stack + Queue + Recursion — LeetCode 10 medium',
    'Wk14: Timed Solving (45 min sessions) — Codeforces contest',
    'Wk15: Full Revision: Sem1 + Sem2 topics — revision sheet',
    'Wk16: Mock Interview: DSA Round 1 — 2 problems in 45 min',
  ],
  3: [
    'Wk1: Trees: DFS traversals (Inorder, Preorder, Postorder)',
    'Wk2: Trees: BFS / Level-order traversal — zigzag traversal',
    'Wk3: Trees: Height & Diameter — max depth, diameter',
    'Wk4: BST: Insert, Delete & LCA — BST operations',
    'Wk5: BST: Validation & floor/ceil — validate BST',
    'Wk6: Heaps: Heapify & min/max heap — implement heap',
    'Wk7: Heaps: Top K elements — kth largest, top k frequent',
    'Wk8: Heaps: Median stream — two heap approach',
    'Wk9: Greedy: Activity selection — meeting rooms',
    'Wk10: Greedy: Scheduling & intervals — min platforms',
    'Wk11: Greedy: Advanced — fractional knapsack, job sequencing',
    'Wk12: Mixed DSA Sprint: Trees + Heaps + Greedy — LeetCode 5 medium',
    'Wk13: Revision: Trees deep dive — path sum problems',
    'Wk14: Revision: Heaps + Greedy patterns — review notes',
    'Wk15: Mock Interview: DSA Round 2 — 2 problems 45min',
    'Wk16: Semester Wrap-up — LeetCode 200+ easy milestone',
  ],
  4: [
    'Wk1: Graphs: BFS & DFS representation',
    'Wk2: Graphs: Connected components & cycle detection',
    'Wk3: Graphs: Bipartite & directed cycle detection',
    'Wk4: Topological sort — Kahn\'s algorithm + DFS topo',
    'Wk5: Shortest path: Dijkstra — implementation',
    'Wk6: Shortest path: Bellman-Ford & Floyd-Warshall',
    'Wk7: DP: Fibonacci memoization & tabulation — climbing stairs',
    'Wk8: DP: 0-1 Knapsack — knapsack variants',
    'Wk9: DP: Subset sum & partition — partition equal subset',
    'Wk10: DP: LIS — O(n log n) approach, Russian envelope',
    'Wk11: DP: LCS & Edit Distance — shortest common supersequence',
    'Wk12: DP: DP on grids — unique paths, min path sum',
    'Wk13: Mixed: Graphs + DP sprint — LeetCode 5 medium',
    'Wk14: Contests + timed solving — Codeforces Div2',
    'Wk15: Revision: Graph patterns — cheat sheet',
    'Wk16: Revision: DP patterns — mock interview',
  ],
  5: [
    'Wk1: Sliding window (variable & fixed) — longest substr, max sum k',
    'Wk2: Two pointers — 3 sum, container with most water',
    'Wk3: KMP algorithm — string pattern matching',
    'Wk4: Rabin-Karp rolling hash — repeated string pattern',
    'Wk5: Advanced Trees: Tree DP patterns — rob house III',
    'Wk6: Advanced Trees: Binary lifting & LCA — kth ancestor',
    'Wk7: Union Find (DSU) — path compression, union by rank',
    'Wk8: MST: Kruskal & Prim — connecting cities',
    'Wk9-11: LeetCode Top 150: Arrays/Strings/Trees/Graphs/DP (10/day)',
    'Wk12-13: Company-level FAANG patterns — tagged problems',
    'Wk14: Mock Interview: FAANG Round 1 — 2 medium 45min',
    'Wk15: Mock Interview: FAANG Round 2 — system design intro',
    'Wk16: Weak Area Fix + Company Research',
  ],
  6: [
    'Wk1-2: DP on Trees: Tree DP advanced — path sum variants',
    'Wk3-4: Bitmask DP — TSP, assignment problem',
    'Wk5: System Design Basics — scaling, load balancing, caching',
    'Wk6: System Design: DB & CAP theorem — SQL vs NoSQL',
    'Wk7: System Design: Design WhatsApp (basic)',
    'Wk8-10: Mock Interviews: Timed (Round 1, 2, 3) — 2 medium 45min each',
    'Wk11: Weak Area Fix: Arrays & Strings',
    'Wk12: Weak Area Fix: DP patterns',
    'Wk13: Weak Area Fix: Graphs & Trees',
    'Wk14: Contest: Codeforces / LeetCode Weekly',
    'Wk15: Full Mock: Complete interview simulation — 90 min',
    'Wk16: Placement Readiness Check — skill audit',
  ],
  7: [
    'Wk1-2: Top 150 Patterns: Arrays, Hashing, Two Pointers (10/day)',
    'Wk3: DSA Revision: Arrays & Strings — 20 problems timed 2h',
    'Wk4: DSA Revision: Trees & Graphs — 20 problems timed 2h',
    'Wk5: DSA Revision: DP — 15 problems timed 2h',
    'Wk6: Mock Interview Round 1 (FAANG format) — coding + behavioral',
    'Wk7: Mock Interview Round 2 (System Design) — Netflix, Uber',
    'Wk8: Live Contest + Analysis Day — upsolve + editorial',
    'Wk9: Pattern Recognition Speed Drills — 2 min per problem',
    'Wk10: OA Practice: Timed online assessments',
    'Wk11: Company Prep: Google tagged problems',
    'Wk12: Company Prep: Microsoft tagged problems',
    'Wk13: Company Prep: Amazon tagged problems',
    'Wk14: Behavioral Prep: STAR method — 5 stories, record yourself',
    'Wk15: Portfolio Review + GitHub cleanup',
    'Wk16: Final Mock + Readiness Assessment',
  ],
  8: [
    'Wk1: Blind 75 Refresh: Arrays & Strings — re-solve 10',
    'Wk2: Blind 75 Refresh: Trees & Graphs — re-solve 10',
    'Wk3: Blind 75 Refresh: DP & Backtracking — re-solve 10',
    'Wk4: System Design Revision: Major Systems — 5 designs',
    'Wk5: Portfolio Polish + LinkedIn Update',
    'Wk6: Mock HR Rounds: Behavioral & Cultural Fit',
    'Wk7: Technical Mock Round: Final loop simulation',
    'Wk8-9: Light Practice + Focus on Offers — 2 problems/day max',
  ],
};

function getSemesterTopics(semester = 1) {
  const sem = Math.max(1, Math.min(8, Number(semester) || 1));
  return DSA_WEEKLY_PLAN[sem] || DSA_WEEKLY_PLAN[1];
}

function parseTimeMin(t) {
  const [h, m] = String(t || '19:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function getDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayEnd(date) {
  const d = getDayStart(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function getStudyWindowsForDate(profile, date) {
  const prefs = profile?.plannerPreferences || {};
  const start = parseTimeMin(prefs.comfortableStart || '19:00');
  const end = parseTimeMin(prefs.comfortableEnd || '23:00');
  const dinnerStart = parseTimeMin(prefs.dinnerTime || '20:00');
  const dinnerEnd = Math.min(end, dinnerStart + 45);
  if (end <= start) return [];
  if (dinnerStart >= end || dinnerEnd <= start) return [{ start, end }];
  const windows = [];
  if (dinnerStart > start) windows.push({ start, end: dinnerStart });
  if (dinnerEnd < end) windows.push({ start: dinnerEnd, end });
  return windows.filter((w) => w.end - w.start >= 25);
}

function getTaskStartEndMin(task) {
  const startMin = parseTimeMin(task.startTime || '19:00');
  const fallbackDuration = Math.max(30, Math.round((task.duration || 3600) / 60));
  const endMin = task.endTime ? parseTimeMin(task.endTime) : Math.min(23 * 60 + 59, startMin + fallbackDuration);
  return { startMin, endMin: Math.max(startMin + 25, endMin) };
}

function findFeasibleSlot({ windows, existingTasks, durationMin }) {
  const sorted = [...existingTasks]
    .map(getTaskStartEndMin)
    .sort((a, b) => a.startMin - b.startMin);

  for (const win of windows) {
    let cursor = win.start;
    for (const itv of sorted) {
      if (itv.endMin <= win.start || itv.startMin >= win.end) continue;
      if (cursor + durationMin <= itv.startMin) break;
      cursor = Math.max(cursor, itv.endMin + 10);
      if (cursor >= win.end) break;
    }
    if (cursor + durationMin <= win.end) {
      return { startMin: cursor, endMin: cursor + durationMin };
    }
  }
  return null;
}

function taskPriorityWeight(priority) {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function canonicalTaskTitle(title = '') {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9: ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getTasksForDay({ userId, date }) {
  const dayStart = getDayStart(date);
  const dayEnd = getDayEnd(date);
  return Task.find({
    user: userId,
    completed: false,
    date: { $gte: dayStart, $lt: dayEnd },
  }).lean();
}

async function placeTaskInFeasibleDay({
  userId,
  profile,
  mode,
  loadMultiplier,
  startDate,
  horizonDays,
  durationMin,
  payloadBuilder,
}) {
  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const targetDate = addDays(startDate, dayOffset);
    const dayTasks = await getTasksForDay({ userId, date: targetDate });
    const isWeekend = [0, 6].includes(targetDate.getDay());
    const dayCap = Math.max(2, Math.round(modeTaskCap(mode, isWeekend) * loadMultiplier));
    if (dayTasks.length >= dayCap) continue;

    const windows = getStudyWindowsForDate(profile, targetDate);
    if (!windows.length) continue;
    const slot = findFeasibleSlot({ windows, existingTasks: dayTasks, durationMin });
    if (!slot) continue;

    // Guard against race/collision: if another generator inserted same slot,
    // skip this day and try next feasible day.
    const conflicting = await Task.findOne({
      user: userId,
      completed: false,
      date: { $gte: getDayStart(targetDate), $lt: getDayEnd(targetDate) },
      startTime: minToTime(slot.startMin),
      endTime: minToTime(slot.endMin),
    }).lean();
    if (conflicting) continue;

    const doc = await Task.create(payloadBuilder({
      date: getDayStart(targetDate),
      startTime: minToTime(slot.startMin),
      endTime: minToTime(slot.endMin),
      durationSec: durationMin * 60,
    }));
    return doc;
  }
  return null;
}

async function scheduleQueuedSkills({
  userId,
  profile,
  mode,
  loadMultiplier,
  today,
  reasons,
}) {
  const queuedSkills = Array.isArray(profile?.skillsToLearn)
    ? profile.skillsToLearn.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (!queuedSkills.length) return 0;

  const horizonDays = Math.max(queuedSkills.length + 3, 10);
  const durationMin = mode === 'recovery' ? 45 : 60;
  let scheduledCount = 0;

  for (const skill of queuedSkills) {
    const title = `Learn: ${skill}`;
    const alreadyPlanned = await Task.findOne({
      user: userId,
      completed: false,
      title,
      date: { $gte: today },
    }).lean();
    if (alreadyPlanned) continue;

    let placed = false;
    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
      const targetDate = addDays(today, dayOffset);
      const dayStart = getDayStart(targetDate);
      const dayEnd = getDayEnd(targetDate);

      const dayTasks = await Task.find({
        user: userId,
        completed: false,
        date: { $gte: dayStart, $lt: dayEnd },
      }).lean();

      const isWeekend = [0, 6].includes(targetDate.getDay());
      const dayCap = Math.max(2, Math.round(modeTaskCap(mode, isWeekend) * loadMultiplier));
      if (dayTasks.length >= dayCap) continue;

      const windows = getStudyWindowsForDate(profile, targetDate);
      if (!windows.length) continue;

      const slot = findFeasibleSlot({ windows, existingTasks: dayTasks, durationMin });
      if (!slot) continue;

      await Task.create({
        user: userId,
        title,
        description: `Queued skill learning session for "${skill}".`,
        date: dayStart,
        startTime: minToTime(slot.startMin),
        endTime: minToTime(slot.endMin),
        duration: durationMin * 60,
        category: 'study',
        priority: 'high',
        completed: false,
        aiGenerated: true,
        plannerMode: mode,
        movedByAgent: 'skill-queue-agent',
        movedReason: 'Queued skill scheduled in first feasible slot',
        explanation: 'Scheduled from your learning queue with dinner-aware and collision-free timing.',
      });

      scheduledCount += 1;
      reasons.push(`Queued skill "${skill}" scheduled on ${toIsoDate(targetDate)}.`);
      placed = true;
      break;
    }

    if (!placed) {
      reasons.push(`Queued skill "${skill}" could not be scheduled in current horizon due to capacity/time limits.`);
    }
  }

  return scheduledCount;
}

async function dedupeFutureTasks({ userId, today }) {
  const horizonEnd = addDays(today, 30);
  const tasks = await Task.find({
    user: userId,
    date: { $gte: today, $lt: horizonEnd },
  }).sort({ date: 1, title: 1, createdAt: 1 });

  const byKey = new Map();
  const duplicateIds = [];

  for (const task of tasks) {
    const canonicalTitle = canonicalTaskTitle(task.title);
    const key = `${toIsoDate(task.date)}|${canonicalTitle}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, task);
      continue;
    }

    const existingWeight =
      (existing.completed ? 100 : 0) +
      taskPriorityWeight(existing.priority) * 10 +
      (existing.rollovers || 0);
    const currentWeight =
      (task.completed ? 100 : 0) +
      taskPriorityWeight(task.priority) * 10 +
      (task.rollovers || 0);
    if (currentWeight > existingWeight) {
      duplicateIds.push(existing._id);
      byKey.set(key, task);
    } else {
      duplicateIds.push(task._id);
    }
  }

  if (duplicateIds.length) {
    await Task.deleteMany({ _id: { $in: duplicateIds } });
  }

  return duplicateIds.length;
}

async function dedupeSameTimeFutureTasks({ userId, today }) {
  const horizonEnd = addDays(today, 30);
  const tasks = await Task.find({
    user: userId,
    date: { $gte: today, $lt: horizonEnd },
  }).sort({ date: 1, startTime: 1, endTime: 1, createdAt: 1 });

  const byKey = new Map();
  const duplicateIds = [];

  for (const task of tasks) {
    const start = String(task.startTime || '').trim();
    const end = String(task.endTime || '').trim();
    if (!start || !end) continue;
    const key = `${toIsoDate(task.date)}|${start}|${end}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, task);
      continue;
    }

    const existingWeight =
      (existing.completed ? 100 : 0) +
      taskPriorityWeight(existing.priority) * 10 +
      (existing.rollovers || 0);
    const currentWeight =
      (task.completed ? 100 : 0) +
      taskPriorityWeight(task.priority) * 10 +
      (task.rollovers || 0);

    if (currentWeight > existingWeight) {
      duplicateIds.push(existing._id);
      byKey.set(key, task);
    } else {
      duplicateIds.push(task._id);
    }
  }

  if (duplicateIds.length) {
    await Task.deleteMany({ _id: { $in: duplicateIds } });
  }
  return duplicateIds.length;
}

async function createDsaTasks({ userId, profile, today, mode, examDays = new Set(), loadMultiplier = 1 }) {
  const topics = getSemesterTopics(profile?.semester || 1);
  if (!topics.length) return 0;

  await Task.deleteMany({
    user: userId,
    aiGenerated: true,
    title: { $regex: /^DSA:/ },
    date: { $gte: today },
  });

  let createdCount = 0;
  const horizonDays = 30;

  for (let dayOffset = 0; dayOffset < topics.length; dayOffset++) {
    const taskDate = addDays(today, dayOffset);
    const dateStr  = toIsoDate(taskDate);
    const dow      = taskDate.getDay(); // 0=Sun, 6=Sat
    const isExam   = examDays.has(dateStr);

    // Exam days: skip DSA (student needs rest)
    if (isExam) continue;

    // Weekend gets longer session; weekday normal
    const isSat = dow === 6;
    const isSun = dow === 0;
    const durMin = isSat ? (mode === 'recovery' ? 60 : 90)   // Sat: extended DSA
                 : isSun ? (mode === 'recovery' ? 45 : 60)   // Sun: medium session
                 : mode === 'recovery' ? 45 : mode === 'strict' ? 90 : 60;

    const topic   = topics[dayOffset % topics.length];
    const label   = isSat ? '📚 [Sat DSA Extended]' : isSun ? '🎯 [Sun DSA Practice]' : '';

    const created = await placeTaskInFeasibleDay({
      userId,
      profile,
      mode,
      loadMultiplier,
      startDate: taskDate,
      horizonDays,
      durationMin: durMin,
      payloadBuilder: ({ date, startTime, endTime, durationSec }) => ({
        user: userId,
        title: `DSA: ${label ? label + ' ' : ''}${topic}`,
        description: `Semester ${profile?.semester || 1} DSA — theory → 3 problems → complexity analysis.`,
        date,
        startTime,
        endTime,
        duration: durationSec,
        category: 'study',
        priority: dayOffset < 3 ? 'high' : isSat || isSun ? 'high' : 'medium',
        aiGenerated: true,
        plannerMode: mode,
        movedByAgent: 'dsa-agent',
        movedReason: 'Daily DSA — centralized orchestration',
        explanation: `DSA: ${topic}. Theory → 3 problems → complexity analysis.`,
      }),
    });
    if (created) createdCount += 1;
  }

  return createdCount;
}


async function createSyllabusTasks({ userId, profile, today, mode, loadMultiplier = 1 }) {
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
  const durationMin = mode === 'recovery' ? 35 : 50;
  let createdCount = 0;
  const horizonDays = 30;

  for (let idx = 0; idx < concepts.length; idx += 1) {
    const item = concepts[idx];
    const subShort = String(item.subject || 'Subject').replace(/\s+/g, ' ').trim().slice(0, 48);
    const preferredStartDate = addDays(today, Math.floor(idx / 2));
    const created = await placeTaskInFeasibleDay({
      userId,
      profile,
      mode,
      loadMultiplier,
      startDate: preferredStartDate,
      horizonDays,
      durationMin,
      payloadBuilder: ({ date, startTime, endTime, durationSec }) => ({
        user: userId,
        title: `Syllabus [${subShort}]: ${item.topic}`,
        description: `${item.subject} — ${item.chapter}`,
        date,
        startTime,
        endTime,
        duration: durationSec,
        category: 'study',
        priority: idx < 3 ? 'high' : 'medium',
        aiGenerated: true,
        plannerMode: mode,
        movedByAgent: 'syllabus-agent',
        movedReason: 'Daily centralized orchestration',
        explanation: 'Syllabus concept imported by centralized orchestrator.',
      }),
    });
    if (created) createdCount += 1;
  }

  return createdCount;
}

async function orchestrateDailyForUser({ userId, trigger = 'manual' }) {
  const today    = getTodayStart();
  const tomorrow = addDays(today, 1);
  const reasons  = [];

  const [profile, latestBurnout, events] = await Promise.all([
    StudentProfile.findOne({ userId }),
    BurnoutLog.findOne({ userId }).sort({ date: -1 }).lean(),
    AcademicEvent.find({ userId, startDate: { $gte: today, $lte: addDays(today, 30) } }).lean(),
  ]);
  if (!profile) throw new Error('Student profile not found');

  const mode         = profile?.planningMode || 'balanced';
  const burnoutLevel = latestBurnout?.burnoutLevel || 'Moderate';
  const burnoutScore = latestBurnout?.burnoutScore || 50;
  const highBurnout  = ['High', 'Critical'].includes(burnoutLevel);
  const loadMultiplier = highBurnout ? 0.7 : 1;
  if (highBurnout) reasons.push('High burnout → 30% load reduction');

  const cgpaLow = Number(profile?.cgpa || 0) > 0 && Number(profile?.cgpa || 0) < 8.5;
  if (cgpaLow) reasons.push('CGPA below 8.5 — adding daily subject revision blocks');

  // Build exam day set for DSA scheduling
  const examDays = new Set(
    events
      .filter(e => ['Exam', 'SlipTest'].includes(e.type))
      .map(e => toIsoDate(e.startDate))
  );
  const hardEventToday = examDays.has(toIsoDate(today));
  if (hardEventToday) reasons.push('Hard exam/slip test constraint active today');

  // ── 1. Handle overdue tasks ───────────────────────────────────────────────
  const preRunDuplicatesRemoved = await dedupeFutureTasks({ userId, today });
  if (preRunDuplicatesRemoved > 0) {
    reasons.push(`Pre-run cleanup removed ${preRunDuplicatesRemoved} duplicate task(s).`);
  }

  const overdue = await Task.find({
    user: userId,
    completed: false,
    date: { $lt: today },
    rollovers: { $lt: 3 },
  }).sort({ date: 1, priority: -1 });

  for (const task of overdue) {
    task.date       = tomorrow;
    task.rollovers  = (task.rollovers || 0) + 1;
    task.priority   = task.rollovers >= 2 ? 'high' : task.priority;
    task.movedByAgent = 'decision-engine';
    task.movedReason  = 'Overdue task auto-shifted by centralized orchestrator';
    task.explanation  = 'Incomplete task shifted to next day; repeated misses escalate priority.';
    await task.save();
  }

  // ── 2. Flag tasks missed 3+ times as urgent & analyze burnout via AI ─────
  const urgentMissed = await Task.find({
    user: userId,
    completed: false,
    rollovers: { $gte: 3 },
    urgentFlagged: { $ne: true },
  });

  for (const task of urgentMissed) {
    task.urgentFlagged = true;
    task.priority      = 'high';
    task.movedByAgent  = 'burnout-agent';
    task.movedReason   = `🚨 URGENT: Missed ${task.rollovers} times. Possible burnout detected.`;
    task.explanation   = `This task has been missed ${task.rollovers} times. The AI has flagged it as urgent and notified the burnout analyzer.`;
    await task.save();

    // Log burnout signal
    try {
      await BurnoutLog.create({
        userId,
        date:         new Date(),
        burnoutLevel: 'High',
        burnoutScore: Math.min(100, 50 + task.rollovers * 10),
        signals:      [`Task "${task.title}" missed ${task.rollovers} times`],
        source:       'missed-task-agent',
        recommendation: `Consider breaking "${task.title}" into smaller sub-tasks or scheduling it at a different time.`,
      });
      reasons.push(`Burnout signal logged: "${task.title}" missed ${task.rollovers}x`);
    } catch (_) {}
  }

  // ── 3. Capacity management ────────────────────────────────────────────────
  const todayTasks = await Task.find({
    user: userId,
    date: { $gte: today, $lt: tomorrow },
  }).sort({ priority: -1, startTime: 1 });

  const todayIsWeekend = [0, 6].includes(today.getDay());
  const cap = Math.max(2, Math.round(modeTaskCap(mode, todayIsWeekend) * loadMultiplier));
  let capacityShifted = 0;

  for (const task of todayTasks.slice(cap)) {
    if (task.completed) continue;
    task.date         = tomorrow;
    task.rollovers    = Math.min(3, (task.rollovers || 0) + 1);
    task.movedByAgent = 'planner-agent';
    task.movedReason  = `Daily capacity exceeded for ${mode} mode`;
    task.explanation  = 'Shifted by centralized orchestrator to maintain healthy daily load.';
    await task.save();
    capacityShifted++;
  }

  // ── 4. CGPA boost: add subject blocks for next 7 days ────────────────────
  let cgpaBoostAdded = false;
  if (cgpaLow) {
    const subjects = profile?.syllabusStructure?.subjects || [];
    const subjectsToAdd = subjects.length
      ? subjects.slice(0, 3)
      : [{ name: 'Core Subject Revision' }, { name: 'Mathematics / Technical Subject' }];
    const baseMin = parseTimeMin(profile?.plannerPreferences?.comfortableStart || '17:00');
    let blocksAdded = 0;

    for (let d = 0; d < 7; d++) {
      const blockDate = addDays(today, d);
      const blockDow  = blockDate.getDay();
      // Skip exam days; lighter on Sunday
      if (examDays.has(toIsoDate(blockDate))) continue;
      const dur = blockDow === 0 ? 30 : 45; // Sundays: lighter

      for (let si = 0; si < subjectsToAdd.length; si++) {
        const subName = subjectsToAdd[si]?.name || `Subject ${si + 1}`;
        const existing = await Task.findOne({
          user: userId,
          date: { $gte: blockDate, $lt: addDays(blockDate, 1) },
          title: `📖 GPA Boost: ${subName}`,
        });
        if (!existing) {
          const slotStart = minToTime(baseMin + si * (dur + 5));
          const slotEnd   = minToTime(Math.min(baseMin + si * (dur + 5) + dur, 23 * 60 + 30));
          await Task.create({
            user: userId,
            title: `📖 GPA Boost: ${subName}`,
            description: `Daily revision — CGPA below 8.5. Focus: ${subName}.`,
            date:      blockDate,
            startTime: slotStart,
            endTime:   slotEnd,
            duration:  dur * 60,
            category:  'study',
            priority:  'high',
            aiGenerated:  true,
            plannerMode:  mode,
            movedByAgent: 'goal-risk-agent',
            movedReason:  'CGPA below 8.5 — daily subject block',
            explanation:  `${dur}-min daily revision for ${subName}. Repeated until CGPA ≥ 8.5.`,
          });
          blocksAdded++;
        }
      }
    }
    cgpaBoostAdded = blocksAdded > 0;
  }

  // ── 5. DSA + Syllabus tasks ───────────────────────────────────────────────
  // Run sequentially to avoid slot-selection races between generators.
  const dsaTasksCreated = await createDsaTasks({ userId, profile, today, mode, examDays, loadMultiplier });
  const syllabusTasksCreated = await createSyllabusTasks({ userId, profile, today, mode, loadMultiplier });

  const queueSkillsScheduled = await scheduleQueuedSkills({
    userId,
    profile,
    mode,
    loadMultiplier,
    today,
    reasons,
  });
  const queueSkillAdded = queueSkillsScheduled > 0;
  const duplicatesRemoved = await dedupeFutureTasks({ userId, today });
  const timeDuplicatesRemoved = await dedupeSameTimeFutureTasks({ userId, today });
  const totalDuplicatesRemoved = preRunDuplicatesRemoved + duplicatesRemoved;
  if (duplicatesRemoved > 0) {
    reasons.push(`Removed ${duplicatesRemoved} duplicate task(s) from upcoming schedule.`);
  }
  if (timeDuplicatesRemoved > 0) {
    reasons.push(`Removed ${timeDuplicatesRemoved} same-time duplicate task(s) from upcoming schedule.`);
  }

  const runLog = await PlannerRunLog.create({
    userId,
    runDate: new Date(),
    trigger,
    status:  'success',
    mode,
    burnout: { level: burnoutLevel, score: burnoutScore, loadMultiplier },
    decisions: {
      overdueShifted: overdue.length,
      capacityShifted,
      dsaTasksCreated,
      syllabusTasksCreated,
      cgpaBoostAdded,
      queueSkillAdded,
      queueSkillsScheduled,
      duplicatesRemoved: totalDuplicatesRemoved + timeDuplicatesRemoved,
      timeDuplicatesRemoved,
      urgentFlagged: urgentMissed.length,
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
