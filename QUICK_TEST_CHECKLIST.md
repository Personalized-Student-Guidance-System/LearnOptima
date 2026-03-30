# 🚀 Quick Test Checklist

## ✅ Before Testing

```
☐ Kill frontend: Ctrl+C in frontend terminal
☐ Kill backend: Ctrl+C in backend terminal
☐ Clear npm cache: npm cache clean --force (optional)
☐ Delete node_modules/.cache (optional)
```

## ✅ Restart Services

```bash
# Terminal 1: Backend
cd c:\Users\USER\Desktop\LearnOptima\backend
npm run dev

# Wait for: (should show no errors)
# - MongoDB connected
# - Server running on port 5000
# - [all routes registered]

# Terminal 2: Frontend  
cd c:\Users\USER\Desktop\LearnOptima\frontend
npm run dev

# Wait for: (should show no errors)
# - VITE ready
# - http://localhost:5173
```

## ✅ Test 1: Skill Analysis Error Fix

**Steps:**
1. Open browser: http://localhost:5173
2. Log in with credentials
3. Navigate to "Skills" (left sidebar)
4. Wait 3 seconds for data load

**Expected:**
- ❌ NO "Unable to load skill analysis" error
- ✅ Score circle visible (top left)
- ✅ Brief analysis card shown
- ✅ "Detailed Gap Breakdown" section visible
- ✅ AI-powered insights displayed

**If Error Occurs:**
```
Check browser console (F12 → Console tab):
- Look for 401 (auth issue) or network errors
- Check network tab for failed requests to /api/skills/analyze
- Verify token in Application → Cookies
```

---

## ✅ Test 2: Study Time Tracking

**Steps:**
1. From dashboard, scroll up to see StudyStats
2. Should see 6 cards below "📊 Your Study Time"
3. Leave browser open for 5+ minutes
4. Refresh page (F5)

**Expected (after 5+ minutes):**
- ✅ TODAY card shows: X minutes, Y sessions
- ✅ THIS WEEK card shows: Hours, average/day
- ✅ 🔥 STREAK shows: Current and best
- ✅ DAILY GOAL shows: % progress (animated bar)
- ✅ WEEKLY GOAL shows: % progress (animated bar)

**If Data is Zero:**
```
1. Hard refresh (Ctrl+Shift+R)
2. Wait additional 5 minutes
3. Check DevTools → Application → Clear site data
4. Try again after refresh
5. Check browser console for errors
```

---

## ✅ Test 3: Dashboard Integration

**Expected On Dashboard Load:**
- ✅ Header with greeting and date
- ✅ StudyStats highlighted in blue card
- ✅ 4 stat cards below (Tasks, CGPA, Goals, Gaps)
- ✅ Tasks table on left, Study Hours chart on right
- ✅ All loading smoothly, no console errors

---

## ✅ Test 4: Study Session Tracking

**Long Test (30 minutes):**
1. Log in to dashboard
2. Study time auto-starts (background)
3. Wait without clicking/typing (10 min)
4. Then click something (resets timer)
5. Continue for 20+ more minutes
6. Log out
7. Log back in → Check StudyStats

**Expected:**
- Session auto-started on login
- Session auto-ended after inactivity (30 min)
- All time properly recorded
- Dashboard shows cumulative time

**Check Backend Logs:**
```
Should see messages like:
[Study] Session started: [sessionId]
[Study] Session ended for user: [userId] - 27 minutes
[Study] Stats compiled for user: [userId]
```

---

## ✅ Test 5: Skill Learning Queue

**Steps:**
1. Go to Skills page
2. Click on a missing skill (red ones)
3. Should be added to "My Learning Queue" section
4. Can remove with ✕ button
5. Can add custom skill via input

**Expected:**
- ✅ Skills added/removed smoothly
- ✅ Persists on page refresh
- ✅ Shows in "learning_queue" in database

---

## ✅ Test 6: Mobile Responsiveness

**On Phone/Tablet:**
1. Login and view dashboard
2. Scroll through StudyStats cards
3. Cards should be responsive grid

**Expected:**
- ✅ Cards wrap to 2-3 columns on mobile
- ✅ Text readable
- ✅ Progress bars visible
- ✅ No horizontal scroll

---

## 📋 API Endpoint Testing (Advanced)

**Using Postman or curl:**

### Test Study Endpoints

```bash
# Start session
POST http://localhost:5000/api/study/session/start
Header: Authorization: Bearer [YOUR_TOKEN]
Body: { "page": "dashboard", "focus": "learning" }

# End session
POST http://localhost:5000/api/study/session/end
Header: Authorization: Bearer [YOUR_TOKEN]
Body: { "notes": "Great session!" }

# Get stats
GET http://localhost:5000/api/study/stats
Header: Authorization: Bearer [YOUR_TOKEN]

# Get history
GET http://localhost:5000/api/study/history?days=7
Header: Authorization: Bearer [YOUR_TOKEN]
```

### Test Skill Endpoints

```bash
# Analyze gap
GET http://localhost:5000/api/skills/analyze
Header: Authorization: Bearer [YOUR_TOKEN]

# AI recommendation
GET http://localhost:5000/api/skills/ai-recommendation
Header: Authorization: Bearer [YOUR_TOKEN]

# Learning path
GET http://localhost:5000/api/skills/learning-path
Header: Authorization: Bearer [YOUR_TOKEN]
```

---

## 🐛 Troubleshooting Quick Guide

| Problem | Check |
|---------|-------|
| Skill page shows error | Browser console for 401/500 errors |
| StudyStats shows 0 mins | Wait 5+ mins, hard refresh (Ctrl+Shift+R) |
| API calls failing | Check token in localStorage, verify server running |
| No data on refresh | Check MongoDB connection, see backend logs |
| Study session not starting | Check browser console, verify /study endpoints exist |

---

## 🎯 Success Indicators

✅ **Skill Analysis Working:**
- Loads without error
- Shows real match score (not "Unable to load")
- AI recommendations visible

✅ **Study Tracking Working:**
- StudyStats cards visible on dashboard
- Numbers update after 5 minutes
- Streak counter working
- Progress bars animated

✅ **Overall System Health:**
- No console errors in DevTools
- Backend logs show study/skill API calls
- All pages load in <2 seconds
- Data persists on refresh

---

## 📞 If All Tests Pass

✅ **System is ready for actual usage!**

Next steps:
1. Invite users to test
2. Monitor backend logs for errors
3. Check database growth (StudySessions accumulating)
4. Gather user feedback

---

## 📊 Monitoring Dashboard

Watch these for production readiness:

```
Performance:
- Page load time < 2s ✅
- API response time < 500ms ✅
- No memory leaks ✅

Data:
- StudySessions accumulating ✅
- Skill analysis returning real data ✅
- Stats calculations accurate ✅

User Experience:
- No 404 errors ✅
- Smooth animations ✅
- Mobile responsive ✅
```

---

**Test Created**: March 29, 2026  
**Est. Test Time**: 30-45 minutes  
**Success Rate Target**: 100% on all 6 tests

