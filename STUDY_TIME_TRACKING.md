# Study Time Tracking System - Complete Documentation

## 🎯 Overview

The LearnOptima study time tracking system automatically monitors:
- **App Session Time**: How long you're actively using the platform
- **Task Time**: Time spent on specific tasks in the planner
- **Page Focus**: Which features you're using
- **Study Patterns**: Streak tracking, daily/weekly/monthly stats
- **Goal Progress**: Daily and weekly study targets

---

## 🔄 How It Works

### 1. **Automatic Session Tracking**

When you log in to the dashboard:

```javascript
useStudyTracking() hook initializes:
├── Starts a StudySession in the database
├── Records startTime
├── Monitors for inactivity (30 minutes = session ends)
├── Tracks page navigation
└── Ends session on logout/window close
```

**Session Data Stored:**
- User ID
- Start time / End time
- Duration (automatically calculated)
- Pages visited
- Focus area (planner, skills, career, etc)
- Individual task times
- Notes/tags

### 2. **Activity Detection**

The system automatically resets the inactivity timer on:
- Mouse clicks
- Keyboard input
- Page scrolling
- Window focus

If no activity for **30 minutes**, the session automatically ends.

### 3. **Task Time Recording**

For each task in your planner:

```javascript
When you work on a task:
├── Start timer immediately
├── Track duration continuously
├── Save to StudySession.taskTimes
└── Calculate total time per task
```

**Recording happens automatically via:**
- Task component focus/unfocus
- Planner transitions
- Manual task timer buttons (coming soon)

---

## 📊 Study Statistics (Dashboard)

### Real-Time Stats Displayed

#### **TODAY**
- Total minutes studied
- Number of sessions
- Active study blocks

#### **THIS WEEK**
- Total hours studied
- Average per day
- Category breakdown (planner, skills, career, etc)

#### **🔥 STREAK**
- Current consecutive days studied
- Longest streak this month

#### **DAILY GOAL PROGRESS**
- Target: 2 hours (120 minutes)
- Visual progress bar
- Percentage towards goal

#### **WEEKLY GOAL PROGRESS**
- Target: 14 hours (840 minutes)
- Visual progress bar
- Percentage towards goal

---

## 💾 Database Schema

### StudySession Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,                    // Which student
  startTime: Date,                     // When session started
  endTime: Date,                       // When session ended (null = active)
  duration: Number,                    // Seconds
  page: String,                        // current page (planner, skills, etc)
  focus: String,                       // learning | coding | planning
  isActive: Boolean,                   // True while session ongoing
  notes: String,                       // Optional notes
  tags: [String],                      // Skill areas studied [react, nodejs]
  taskTimes: [
    {
      taskId: ObjectId,
      taskTitle: String,
      timeSpent: Number,               // Seconds
      category: String,                // homework, project, practice
      date: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 📈 API Endpoints

### Study Tracking Endpoints

```
POST /study/session/start
- Body: { page?, focus?, tags? }
- Returns: { sessionId, startTime }
- Purpose: Begin study session

POST /study/session/end
- Body: { sessionId?, notes? }
- Returns: { duration, durationMinutes, endTime }
- Purpose: End active study session

POST /study/task-time
- Body: { taskId, timeSpent, sessionId? }
  (timeSpent in seconds)
- Purpose: Record time spent on a task

GET /study/stats
- Returns: { today, week, month, streak, goalStatus }
- Includes breakdown by category
- Purpose: Get comprehensive study stats

GET /study/history?days=30
- Returns: { sessions: [...], totalMinutes }
- Purpose: Get historical data for charting
```

### Response Example: `/study/stats`

```javascript
{
  today: {
    sessions: 3,           // Number of study blocks
    minutes: 45,
    hours: 0
  },
  week: {
    sessions: 18,
    minutes: 480,          // 8 hours
    hours: 8,
    avgMinutesPerDay: 82,  // Average per day
    categoryBreakdown: [
      { category: 'planner', minutes: 220, hours: 4 },
      { category: 'skills', minutes: 150, hours: 2 },
      { category: 'career', minutes: 110, hours: 2 }
    ]
  },
  month: {
    sessions: 72,
    minutes: 1800,         // 30 hours
    hours: 30
  },
  streak: {
    currentStreak: 12,     // Days studied consecutively
    longestStreak: 18      // Best streak this month
  },
  goalStatus: {
    dailyGoal: 120,        // Target 2 hours
    weeklyGoal: 840,       // Target 14 hours
    todayProgress: 38,     // 38% towards 2h goal
    weekProgress: 57       // 57% towards 14h goal
  }
}
```

---

## 🧮 Calculation Logic

### Duration Calculation

```javascript
Session Duration = (endTime - startTime) / 1000  // in seconds

// Displayed as:
minutes = Math.round(duration / 60)
hours = Math.round(minutes / 60)
```

### Daily Study Time

```javascript
1. Filter all sessions for today (00:00 - 23:59)
2. For each session: taskTimes[].timeSpent
3. Sum all task times
4. Add main session duration if no tasks recorded
5. Result = total minutes studied today
```

### Weekly Breakdown

```javascript
const weekStart = Monday of current week
const weekEnd = Sunday of current week, 23:59

1. Find all sessions between weekStart and weekEnd
2. Group by category (from taskTimes[].category)
3. Sum time per category:
   - Planner = planning/homework tasks
   - Skills = skill-focused study
   - Career = career planning/roadmap
   - Academic = subject study
   - General = other

4. Calculate daily average:
   avgMinutesPerDay = weekTotal / daysWithActivity
```

### Streak Calculation

```javascript
1. Group sessions by date (toDateString())
2. Sort dates descending (newest first)
3. Start from today:
   - If today has session: currentStreak++
   - If yesterday has session: continue++
   - If break found: stop counting

4. longestStreak = max consecutive days
5. currentStreak = from today going back
```

### Goal Progress

```javascript
// Daily Goal Progress
todayProgress = Math.min(100, Math.round((todayMinutes / 120) * 100))
// 120 minutes = 2 hour target

// Weekly Goal Progress
weekProgress = Math.min(100, Math.round((weekMinutes / 840) * 100))
// 840 minutes = 14 hour target
```

---

## 🚀 Frontend Integration

### Study Tracking Hook

```javascript
useStudyTracking()
├── Auto-starts session on app open
├── Tracks inactivity (30 min timeout)
├── Monitors page navigation
├── Auto-ends session on logout
└── Syncs all data to backend
```

### Task Timer Hook

```javascript
useTaskTimer(taskId)
├── startTimer() - begins timing task
├── stopTimer() - ends and saves time
├── getElapsed() - returns seconds elapsed
└── Auto-saves on component unmount
```

### StudyStats Component

```javascript
<StudyStats />
Displays:
├── Today card (minutes, sessions)
├── This week card (hours, average)
├── Streak tracker (🔥 current/best)
├── Daily goal progress bar
└── Weekly goal progress bar

Updates every 5 minutes automatically
```

---

## 📱 Example Usage Flow

### User Session Example

```
09:00 - User logs in
       └→ StudySession created, startTime=09:00

09:00-09:45 - Studies React skills page
               └→ Recorded as 45 min session

09:45-09:50 - Breaks (checks messages)

10:00-10:30 - Works on Planner task "Build Todo App"
               └→ taskTime recorded: 30 min, category=project

10:30-11:00 - Inactivity (idle, no clicks/keys)
               └→ 20 min remains, then session auto-ends

11:00 - User logs out
       └→ SessionId saved permanently

DAILY STATS SHOW:
- Today: 1h 15 min total (2 sessions)
- Planner: 30 min (task = Build Todo App)
- Skills: 45 min
- Daily goal: 63% progress towards 2h target
```

---

## 🔍 Monitoring & Analytics

### Available Reports

**Get Daily Insights**
```
GET /study/stats
Shows today's focus, categories, goal progress, streak
```

**Get Historical Data**
```
GET /study/history?days=30
Returns 30 days of sessions for charting/analysis
```

**Future Features**

- Weekly reports (email digest)
- Focus quality analysis (task completion rate)
- Learning path time estimates (vs actual)
- Peer comparison (anon, if opted-in)
- Productivity recommendations based on patterns
- Calendar heatmap of study days

---

## ⚠️ Known Behavior

### Session Auto-End

- **Trigger**: 30 minutes with no user activity
- **Activity**: Click, keystroke, scroll, window focus
- **Benefit**: Prevents inflated study time from forgotten browsers

### Task Time Recording

- Records when task loses focus
- Accumulates across multiple work sessions
- Defaults to 1 hour if task title unclear

### Category Detection

Automatic categorization:
- **Planner** → tasks in Planner page
- **Skills** → on Skills/SkillGap page
- **Career** → on Career/Roadmap page
- **Academic** → on AcademicData page
- **Burnout** → on BurnoutPredictor page
- **General** → unrecognized pages

### Timezone

- Uses browser's local timezone
- Dates calculated on client side
- Server stores UTC timestamps

---

## 🆘 Troubleshooting

### Study stats show 0 minutes

**Causes:**
1. No active sessions yet (wait 5+ minutes)
2. Stats endpoint returning null
3. Browser cache (clear localStorage)

**Solution:**
```javascript
// Force refresh
1. Open DevTools (F12)
2. Application → Storage → Clear Site Data
3. Refresh page
4. Stats should update within 5 minutes
```

### Sessions not starting

**Check:**
1. Ensure logged in (auth token present)
2. Check browser console (F12) for errors
3. Verify `/study/session/start` endpoint responds
4. Check MongoDB StudySession collection

### Goal progress stuck at 100%

**Expected**: Caps at 100% (you've met goal!)
**Reset**: Goals reset daily at 00:00 UTC

---

## 🎯 Best Practices

1. **Focus Sessions**: Work on 1-2 skills per session for better tracking
2. **Break Often**: Let inactivity timer reset between focus blocks (Pomodoro)
3. **Tag Your Work**: Add tags for skill focus areas
4. **Regular Check-in**: View stats weekly to see patterns
5. **Adjust Goals**: Customize daily (2h) and weekly (14h) targets in settings (coming soon)

---

## 📚 Integration with Other Features

### Skill Gap Analyzer
- Uses study time data to estimate learning pace
- Adjusts recommendations based on your availability
- Shows "estimated completion" based on current rate

### Dashboard
- Tasks Due Today uses study session count
- Study Hours chart pulls from taskTimes data
- Quick Actions badge shows study streak

### Career Roadmap
- Timeline estimates adjusted based on study hours
- Checks if you're on track for role requirements

### Goals Page (future)
- Shows time invested per goal
- Calculates average time to completion
- Predicts goal completion date

---

**Last Updated**: March 29, 2026  
**System Version**: 2.0 (ML + Agentic AI + Study Tracking)

