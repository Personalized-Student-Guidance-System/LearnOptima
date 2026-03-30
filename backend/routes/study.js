const router = require('express').Router();
const auth = require('../middleware/auth');
const StudySession = require('../models/StudySession');
const Task = require('../models/Task');

/**
 * POST /study/session/start
 * Start a new study session
 */
router.post('/session/start', auth, async (req, res) => {
  try {
    const { page, focus, tags } = req.body;
    
    const session = new StudySession({
      userId: req.user.id,
      startTime: new Date(),
      page: page || 'dashboard',
      focus: focus || 'general',
      isActive: true,
      tags: tags || []
    });
    
    await session.save();
    
    console.log(`[Study] Session started for user ${req.user.id}`, session._id);
    
    res.json({
      message: 'Study session started',
      sessionId: session._id,
      startTime: session.startTime
    });
  } catch (err) {
    console.error('[Study] Session start error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /study/session/end
 * End current study session
 */
router.post('/session/end', auth, async (req, res) => {
  try {
    const { sessionId, notes } = req.body;
    
    // Find active session
    const session = await StudySession.findOne({
      userId: req.user.id,
      isActive: true,
      $or: [
        { _id: sessionId },
        { _id: { $exists: true }, endTime: null }
      ]
    }).sort({ startTime: -1 }).limit(1);
    
    if (!session) {
      return res.status(404).json({ message: 'No active session found' });
    }
    
    session.endTime = new Date();
    session.isActive = false;
    session.notes = notes;
    
    await session.save();
    
    const durationMinutes = Math.round(session.duration / 60);
    
    console.log(`[Study] Session ended for user ${req.user.id}: ${durationMinutes} minutes`);
    
    res.json({
      message: 'Study session ended',
      sessionId: session._id,
      duration: session.duration,
      durationMinutes: durationMinutes,
      endTime: session.endTime
    });
  } catch (err) {
    console.error('[Study] Session end error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /study/task-time
 * Record time spent on a specific task
 */
router.post('/task-time', auth, async (req, res) => {
  try {
    const { taskId, timeSpent, sessionId } = req.body; // timeSpent in seconds
    
    if (!taskId || !timeSpent) {
      return res.status(400).json({ message: 'taskId and timeSpent required' });
    }
    
    // Find active session
    let session = await StudySession.findOne({
      userId: req.user.id,
      isActive: true,
      $or: [
        { _id: sessionId },
        { _id: { $exists: true }, endTime: null }
      ]
    }).sort({ startTime: -1 }).limit(1);
    
    // Create session if not exists
    if (!session) {
      session = new StudySession({
        userId: req.user.id,
        startTime: new Date(),
        isActive: true,
        page: 'planner',
        focus: 'task'
      });
    }
    
    // Get task details if available
    let taskTitle = 'Unknown Task';
    let category = 'General';
    
    try {
      const task = await Task.findById(taskId);
      if (task) {
        taskTitle = task.title;
        category = task.category || 'General';
      }
    } catch (e) {
      // Task might not exist, continue anyway
    }
    
    // Add or update task time
    const existingTaskTime = session.taskTimes.find(tt => tt.taskId?.toString() === taskId);
    
    if (existingTaskTime) {
      existingTaskTime.timeSpent += timeSpent;
    } else {
      session.taskTimes.push({
        taskId: taskId,
        taskTitle: taskTitle,
        timeSpent: timeSpent,
        category: category,
        date: new Date()
      });
    }
    
    await session.save();
    
    console.log(`[Study] Task time recorded: ${taskTitle} - ${timeSpent}s for user ${req.user.id}`);
    
    res.json({
      message: 'Task time recorded',
      sessionId: session._id,
      totalSessionTime: session.duration,
      taskTime: timeSpent
    });
  } catch (err) {
    console.error('[Study] Task time error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /study/stats
 * Get study statistics for user
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch user to get their custom goals
    const User = require('../models/User');
    const user = await User.findById(userId);
    const dailyGoalMinutes = user?.dailyGoalMinutes || 120; // 2 hours default
    const weeklyGoalMinutes = user?.weeklyGoalMinutes || 840; // 14 hours default
    
    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysSessions = await StudySession.find({
      userId,
      startTime: { $gte: today }
    });
    
    const todayDuration = todaysSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const todayMinutes = Math.round(todayDuration / 60);
    const todaySessionCount = todaysSessions.length;
    
    // This week's stats
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekSessions = await StudySession.find({
      userId,
      startTime: { $gte: weekStart }
    });
    
    const weekDuration = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const weekMinutes = Math.round(weekDuration / 60);
    const weekHours = Math.round(weekMinutes / 60);
    
    // This month's stats
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthSessions = await StudySession.find({
      userId,
      startTime: { $gte: monthStart }
    });
    
    const monthDuration = monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const monthMinutes = Math.round(monthDuration / 60);
    const monthHours = Math.round(monthMinutes / 60);
    
    // Category breakdown (this week)
    const categoryStats = {};
    weekSessions.forEach(session => {
      session.taskTimes.forEach(taskTime => {
        const cat = taskTime.category || 'Uncategorized';
        if (!categoryStats[cat]) {
          categoryStats[cat] = 0;
        }
        categoryStats[cat] += taskTime.timeSpent;
      });
    });
    
    // Convert to minutes and sort
    const categoryBreakdown = Object.entries(categoryStats)
      .map(([cat, seconds]) => ({
        category: cat,
        minutes: Math.round(seconds / 60),
        hours: Math.round(seconds / 3600)
      }))
      .sort((a, b) => b.minutes - a.minutes);
    
    // Calculate daily average
    const daysSinceWeekStart = Math.ceil((new Date() - weekStart) / (1000 * 60 * 60 * 24));
    const avgMinutesPerDay = Math.round(weekMinutes / Math.max(daysSinceWeekStart, 1));
    
    // Calculate STREAK: Look at all-time sessions, not just last 7 days
    const allTimeSessions = await StudySession.find({ userId }).sort({ startTime: 1 });
    const streakData = calculateStreakAllTime(allTimeSessions);
    
    // Calculate daily breakdown for the week (for dashboard charts)
    const dailyBreakdown = {};
    
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + d);
      const dayEnd = new Date(day);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayKey = day.toLocaleDateString('en-US', { weekday: 'short' }); // 'Mon', 'Tue', etc
      const daySessions = weekSessions.filter(s => s.startTime >= day && s.startTime < dayEnd);
      const dayMinutes = Math.round(daySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
      dailyBreakdown[dayKey] = dayMinutes;
    }
    
    res.json({
      today: {
        sessions: todaySessionCount,
        minutes: todayMinutes,
        hours: Math.round(todayMinutes / 60)
      },
      week: {
        sessions: weekSessions.length,
        minutes: weekMinutes,
        hours: weekHours,
        avgMinutesPerDay: avgMinutesPerDay,
        categoryBreakdown: categoryBreakdown,
        dailyMinutes: dailyBreakdown  // Add daily breakdown for chart rendering
      },
      month: {
        sessions: monthSessions.length,
        minutes: monthMinutes,
        hours: monthHours
      },
      streak: streakData,
      totalMinutes: Math.round(monthDuration / 60),  // All-time total
      dailyMinutes: dailyBreakdown,  // Top-level for backward compatibility
      goalStatus: {
        dailyGoal: dailyGoalMinutes,
        weeklyGoal: weeklyGoalMinutes,
        todayProgress: Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100)),
        weekProgress: Math.min(100, Math.round((weekMinutes / weeklyGoalMinutes) * 100))
      }
    });
  } catch (err) {
    console.error('[Study] Stats error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /study/history
 * Get study session history
 */
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days || 30); // default 30 days
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const sessions = await StudySession.find({
      userId,
      startTime: { $gte: startDate }
    })
    .sort({ startTime: -1 })
    .lean();
    
    // Format sessions for display
    const formattedSessions = sessions.map(s => ({
      _id: s._id,
      date: s.startTime.toLocaleDateString(),
      startTime: s.startTime.toLocaleTimeString(),
      duration: Math.round(s.duration / 60), // minutes
      page: s.page,
      focus: s.focus,
      taskCount: s.taskTimes?.length || 0,
      topTask: s.taskTimes?.[0]?.taskTitle || 'N/A'
    }));
    
    res.json({
      totalSessions: formattedSessions.length,
      totalMinutes: sessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0),
      sessions: formattedSessions
    });
  } catch (err) {
    console.error('[Study] History error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /study/session/page
 * Update current session page/category
 */
router.post('/session/page', auth, async (req, res) => {
  try {
    const { page } = req.body;
    
    if (!page) {
      return res.status(400).json({ message: 'page is required' });
    }
    
    // Find active session
    const session = await StudySession.findOne({
      userId: req.user.id,
      isActive: true,
      endTime: null
    }).sort({ startTime: -1 }).limit(1);
    
    if (!session) {
      return res.status(404).json({ message: 'No active session found' });
    }
    
    session.page = page;
    await session.save();
    
    console.log(`[Study] Session page updated to '${page}' for user ${req.user.id}`);
    
    res.json({
      message: 'Session page updated',
      sessionId: session._id,
      page: session.page
    });
  } catch (err) {
    console.error('[Study] Session page update error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * Calculate streak from all-time sessions (not just last 7 days)
 * Looks backward from today to find consecutive days with activity
 */
function calculateStreakAllTime(allSessions) {
  if (allSessions.length === 0) return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  
  // Group sessions by DATE (YYYY-MM-DD format for consistency)
  const dateMap = {};
  allSessions.forEach(session => {
    const date = new Date(session.startTime);
    const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    if (!dateMap[dateStr]) {
      dateMap[dateStr] = true;
    }
  });
  
  const dates = Object.keys(dateMap).sort().reverse(); // Most recent first
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  
  const lastActivityDate = dates[0];
  
  // Calculate current streak: Check consecutive days from today backward
  let currentStreak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  
  // Keep checking backward through dates
  while (true) {
    const checkDateStr = checkDate.toLocaleDateString('en-CA');
    if (dates.includes(checkDateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Stop if we find a gap
      break;
    }
  }
  
  // Calculate longest streak: Go through all dates and find max consecutive days
  let longestStreak = 0;
  let currentCount = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const currDate = new Date(dates[i]);
    const nextDate = new Date(dates[i + 1]);
    const diffDays = Math.round((currDate - nextDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      currentCount++;
    } else {
      // Gap found
      longestStreak = Math.max(longestStreak, currentCount);
      currentCount = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentCount);
  
  return {
    currentStreak: currentStreak,
    longestStreak: longestStreak,
    lastActivityDate: lastActivityDate,
    totalDaysActive: dates.length
  };
}

function calculateStreak(weekSessions) {
  if (weekSessions.length === 0) return { currentStreak: 0, longestStreak: 0 };
  
  // Group by date
  const dateMap = {};
  weekSessions.forEach(session => {
    const date = session.startTime.toDateString();
    if (!dateMap[date]) {
      dateMap[date] = true;
    }
  });
  
  const dates = Object.keys(dateMap).sort().reverse();
  
  let currentStreak = 0;
  const today = new Date().toDateString();
  let checkDate = new Date(today);
  
  while (dates.includes(checkDate.toDateString())) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return {
    currentStreak: currentStreak,
    longestStreak: dates.length // Simple: longest is all days with sessions
  };
}

module.exports = router;
