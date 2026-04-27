import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';
import API, {
  addAcademicCalendarEvents,
  getPlannerConstants,
  getPlannerRisk,
  generateTimetable,
  getOrchestrationRuns,
  runCentralOrchestration,
  savePlannerConstants,
  syncDsaRoadmap,
  syncSyllabusConcepts,
  updateTaskStatus,
} from '../services/api';
import { useStudy } from '../context/StudyContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PRIORITIES = ['low', 'medium', 'high'];
const CATEGORIES = ['study', 'assignment', 'project', 'exam', 'personal', 'other'];
const TIMELINE_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 -> 23:00

const priColor = { high: G.red, medium: G.amber, low: G.text3 };
const priBg    = { high: G.redBg, medium: G.amberBg, low: G.bg2 };
const priBd    = { high: G.redBd, medium: G.amberBd, low: G.border };

function toMinutes(time) {
  const [h, m] = String(time || '00:00').split(':').map((v) => Number(v) || 0);
  return h * 60 + m;
}

function fromMinutes(total) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const h = String(Math.floor(safe / 60)).padStart(2, '0');
  const m = String(safe % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function timelineBlockStyle(slot) {
  const start = toMinutes(slot.startTime);
  const end = Math.max(start + 20, toMinutes(slot.endTime));
  const startBase = 6 * 60;
  const pxPerMinute = 0.9;
  const top = Math.max(0, (start - startBase) * pxPerMinute);
  const height = Math.max(24, (end - start) * pxPerMinute);
  return { top, height };
}

function slotTheme(slotType, priority) {
  if (slotType === 'blocked') return { bg: G.bg2, border: G.border, color: G.text2 };
  if (slotType === 'hobby') return { bg: G.greenBg, border: G.greenBd, color: G.green };
  if (slotType === 'enrichment') return { bg: '#f0fdf4', border: G.greenBd, color: '#16a34a' };
  if (priority === 'high') return { bg: G.redBg, border: G.redBd, color: G.red };
  if (priority === 'medium') return { bg: G.amberBg, border: G.amberBd, color: G.amber };
  return { bg: G.blueBg, border: G.blueBd, color: G.blue };
}

export default function Planner() {
  const { agentNotifications, dismissNotification } = useStudy();
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarForm, setCalendarForm] = useState({ dates: [], type: 'Exam', recurringMonthly: false });
  const [view, setView] = useState('day');
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonthDate, setSelectedMonthDate] = useState(null);
  const [form, setForm] = useState({ title: '', date: '', startTime: '', endTime: '', category: 'study', priority: 'medium', description: '' });
  const [saving, setSaving] = useState(false);
  const [profileRoles, setProfileRoles] = useState([]);
  const [syncRole, setSyncRole] = useState('');
  const [planningMode, setPlanningMode] = useState('balanced');
  const [risk, setRisk] = useState({ riskLevel: 'low', riskScore: 0, reasons: [] });
  const [replanning, setReplanning] = useState(false);
  const [syncingDsa, setSyncingDsa] = useState(false);
  const [syncingSyllabus, setSyncingSyllabus] = useState(false);
  const [buildingTimetable, setBuildingTimetable] = useState(false);
  const [timetable, setTimetable] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [draggingSlot, setDraggingSlot] = useState(null);
  const [draggingDay, setDraggingDay] = useState(null);
  const [orchestrationRuns, setOrchestrationRuns] = useState([]);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonTask, setReasonTask] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [prefs, setPrefs] = useState({
    wakeTime: '06:30',
    sleepTime: '23:00',
    dinnerTime: '20:00',
    // Default 7pm-11pm — for college students studying after college hours
    comfortableStart: '19:00',
    comfortableEnd: '23:00',
    hobbies: '',
  });

  useEffect(() => { 
    fetchData();
  }, [currentDate]);

  useEffect(() => {
    fetchPlannerMeta();
  }, []);

  const fetchPlannerMeta = async () => {
    try {
      const [constantsRes, riskRes] = await Promise.all([
        getPlannerConstants(),
        getPlannerRisk(),
      ]);
      const constants = constantsRes.data || {};
      setPlanningMode(constants.planningMode || 'balanced');
      if (constants.plannerPreferences) {
        setPrefs({
          wakeTime: constants.plannerPreferences.wakeTime || '06:30',
          sleepTime: constants.plannerPreferences.sleepTime || '23:00',
          dinnerTime: constants.plannerPreferences.dinnerTime || '20:00',
          comfortableStart: constants.plannerPreferences.comfortableStart || '19:00',
          comfortableEnd: constants.plannerPreferences.comfortableEnd || '23:00',
          hobbies: (constants.plannerPreferences.hobbies || []).join(', '),
        });
      }
      setRisk(riskRes.data || { riskLevel: 'low', riskScore: 0, reasons: [] });
      const runsRes = await getOrchestrationRuns(6);
      setOrchestrationRuns(runsRes.data || []);
    } catch (err) {
      console.error('Planner meta fetch error:', err);
    }
  };

  const fetchData = async () => {
    try {
      const start = new Date(currentDate); start.setMonth(start.getMonth() - 1);
      const end = new Date(currentDate); end.setMonth(end.getMonth() + 1);
      const [taskRes, eventRes] = await Promise.all([
        API.get('/planner', { params: { start: start.toISOString(), end: end.toISOString() } }),
        API.get('/planner/calendar-events')
      ]);
      setTasks(taskRes.data);
      setCalendarEvents(eventRes.data.map(e => ({
        id: e._id,
        title: e.type,
        start: e.date,
        backgroundColor: e.type === 'Holiday' ? G.green : e.type === 'Exam' ? G.red : G.amber,
        borderColor: e.type === 'Holiday' ? G.green : e.type === 'Exam' ? G.red : G.amber,
        editable: false
      })));
      // Profile roles
      const profileRes = await API.get('/profile');
      const roles = profileRes.data?.targetRoles || (profileRes.data?.targetRole ? [profileRes.data.targetRole] : []);
      setProfileRoles(roles);
      if (roles.length > 0) setSyncRole(roles[0]);
    } catch (err) { console.error('Fetch error:', err); }
  };

  const fetchTasks = async () => {
    try {
      const start = new Date(currentDate); start.setDate(start.getDate() - 30);
      const end   = new Date(currentDate); end.setDate(end.getDate() + 30);
      const res = await API.get('/planner', { params: { start: start.toISOString(), end: end.toISOString() } });
      setTasks(res.data);
    } catch {}
  };

  const addTask = async () => {
    setSaving(true);
    try {
      await API.post('/planner', form);
      setShowModal(false);
      setForm({ title: '', date: '', startTime: '', endTime: '', category: 'study', priority: 'medium', description: '' });
      fetchTasks();
    } catch {} finally { setSaving(false); }
  };

  const toggleTask = async (task) => {
    try {
      await updateTaskStatus(task._id, { completed: !task.completed, reasonText: task.completionReason || '' });
      fetchTasks();
    } catch (err) {
      if (err?.response?.data?.code === 'TASK_WINDOW_EXCEEDED') {
        alert(err?.response?.data?.message || 'Task window exceeded. Task moved to next day.');
        fetchTasks();
        return;
      }
      alert(err?.response?.data?.message || 'Failed to update task status');
    }
  };

  const submitTaskReason = async (markCompleted = false) => {
    if (!reasonTask) return;
    try {
      await updateTaskStatus(reasonTask._id, {
        completed: markCompleted,
        reasonText,
      });
      setShowReasonModal(false);
      setReasonTask(null);
      setReasonText('');
      fetchTasks();
      fetchPlannerMeta();
    } catch (err) {
      if (err?.response?.data?.code === 'TASK_WINDOW_EXCEEDED') {
        alert(err?.response?.data?.message || 'Task window exceeded. Task moved to next day.');
        fetchTasks();
        return;
      }
      alert(err?.response?.data?.message || 'Failed to save task status');
    }
  };

  const deleteTask = async (id) => {
    try { await API.delete(`/planner/${id}`); fetchTasks(); } catch {}
  };

  const generateAI = async () => {
    if (!syncRole) return alert('Please define a Target Role in your Profile first.');
    setGenerating(true);
    try {
      const res = await API.post('/planner/sync-roadmap', { role: syncRole });
      const tasks = res.data?.tasks;
      const n = Array.isArray(tasks) ? tasks.length : 0;
      const hint = res.data?.warning ? `\n${res.data.warning}` : '';
      alert(`Synced ${n} roadmap tasks.${hint}`);
      setShowAI(false);
      fetchTasks();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      alert(msg || 'Sync failed. Open Career Roadmap once for this role so the roadmap is saved to the database, then try again.');
    } finally {
      setGenerating(false);
    }
  };

  const saveMode = async (mode) => {
    try {
      setPlanningMode(mode);
      await savePlannerConstants({
        planningMode: mode,
        ...prefs,
        hobbies: prefs.hobbies.split(',').map((h) => h.trim()).filter(Boolean),
      });
      await fetchPlannerMeta();
    } catch (err) {
      console.error('Mode update failed', err);
    }
  };

  const runDailyReplan = async () => {
    setReplanning(true);
    try {
      const res = await runCentralOrchestration();
      alert(`Central orchestrator complete. Shifted ${res.data.decisions?.overdueShifted || 0} overdue, ${res.data.decisions?.capacityShifted || 0} capacity tasks.`);
      fetchData();
      fetchPlannerMeta();
    } catch (err) {
      alert(err?.response?.data?.message || 'Daily replan failed');
    } finally {
      setReplanning(false);
    }
  };

  const runDsaSync = async () => {
    setSyncingDsa(true);
    try {
      const res = await syncDsaRoadmap();
      alert(`DSA roadmap synced for semester ${res.data.semester}. Added ${res.data.tasksCreated} tasks.`);
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || 'DSA sync failed');
    } finally {
      setSyncingDsa(false);
    }
  };

  const runSyllabusSync = async () => {
    setSyncingSyllabus(true);
    try {
      const res = await syncSyllabusConcepts(12);
      alert(`Syllabus concepts imported: ${res.data.importedConcepts}. Added ${res.data.tasksCreated} tasks.`);
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Syllabus sync failed');
    } finally {
      setSyncingSyllabus(false);
    }
  };

  const buildTimetable = async () => {
    setBuildingTimetable(true);
    try {
      const res = await generateTimetable(7);
      setTimetable(res.data.dailyPlan || []);
      fetchPlannerMeta();
    } catch (err) {
      alert(err?.response?.data?.message || 'Timetable generation failed');
    } finally {
      setBuildingTimetable(false);
    }
  };

  const getConflictsForDay = (day) => {
    const taskSlots = (day?.timeline || [])
      .filter((slot) => slot.type === 'task')
      .map((slot) => ({
        ...slot,
        start: toMinutes(slot.startTime),
        end: toMinutes(slot.endTime),
      }))
      .sort((a, b) => a.start - b.start);

    const conflicts = [];
    for (let i = 1; i < taskSlots.length; i += 1) {
      if (taskSlots[i].start < taskSlots[i - 1].end) {
        conflicts.push({
          a: taskSlots[i - 1].title,
          b: taskSlots[i].title,
        });
      }
    }
    return conflicts;
  };

  const moveTaskInTimetable = async ({ taskId, targetDate, targetStartMin, durationMin }) => {
    const startTime = fromMinutes(targetStartMin);
    const endTime = fromMinutes(targetStartMin + durationMin);
    try {
      await API.put(`/planner/${taskId}`, {
        date: targetDate,
        startTime,
        endTime,
        movedByAgent: 'manual-user-drag',
        movedReason: 'User rescheduled via planner grid drag/drop',
        explanation: 'Manually moved from timetable grid.',
      });
      await fetchData();
      await buildTimetable();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to reschedule task');
    }
  };

  const submitCalendar = async () => {
    try {
      const dates = calendarForm.dates
        .map((d) => (typeof d === 'string' ? d : d?.toISOString?.().slice(0, 10)))
        .filter(Boolean);
      if (!dates.length) {
        alert('Please add at least one date');
        return;
      }
      const events = dates.map((date) => ({
        title: `${calendarForm.type} - ${date}`,
        type: calendarForm.type,
        startDate: date,
        endDate: date,
      }));
      await addAcademicCalendarEvents(events);
      setShowCalendarModal(false);
      setCalendarForm({ dates: [], type: 'Exam', recurringMonthly: false });
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to save calendar');
    }
  };

  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };

  const todayTasks = tasks.filter(t => new Date(t.date).toDateString() === currentDate.toDateString());
  const completed  = todayTasks.filter(t => t.completed).length;

  return (
    <>
      <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Smart Planner</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>AI-generated study plans based on your goals and schedule</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: G.bg2, border: `1px solid ${G.border}`, borderRadius: 6, padding: '2px' }}>
            {['strict', 'balanced', 'recovery'].map((mode) => (
              <button
                key={mode}
                onClick={() => saveMode(mode)}
                style={{
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: planningMode === mode ? G.white : 'transparent',
                  color: planningMode === mode ? G.text : G.text2,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPrefsModal(true)}>
            Preferences
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCalendarModal(true)}>
            Add Academic Calendar
          </button>
          <button className="btn btn-secondary btn-sm" onClick={runDailyReplan} disabled={replanning}>
            {replanning ? <><Spinner /> Replanning…</> : 'Replan Now'}
          </button>
          {/* View toggle */}
          <div style={{ display: 'flex', background: G.bg2, borderRadius: 6, padding: 2, border: `1px solid ${G.border}` }}>
            {['day', 'week', 'month'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', background: view === v ? G.white : 'transparent', color: view === v ? G.text : G.text2, fontFamily: "'Plus Jakarta Sans'", fontWeight: 600, fontSize: 12, boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAI(true)}>
            <Ic path={ICONS.refresh} size={12} /> AI Generate
          </button>
          <button className="btn btn-secondary btn-sm" onClick={runDsaSync} disabled={syncingDsa}>
            {syncingDsa ? <><Spinner /> Syncing DSA…</> : 'DSA Roadmap'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={runSyllabusSync} disabled={syncingSyllabus}>
            {syncingSyllabus ? <><Spinner /> Syncing Syllabus…</> : 'Import Syllabus Concepts'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={buildTimetable} disabled={buildingTimetable}>
            {buildingTimetable ? <><Spinner /> Building…</> : 'Build Smart Timetable'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Ic path={ICONS.plus} size={12} /> New Task
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          const d = new Date(currentDate);
          if (view === 'month') d.setMonth(d.getMonth() - 1);
          else d.setDate(d.getDate() - 7);
          setCurrentDate(d);
        }}>← {view === 'month' ? 'Prev month' : 'Prev week'}</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
          {currentDate.toLocaleDateString('en-US', view === 'month'
            ? { month: 'long', year: 'numeric' }
            : { month: 'long', year: 'numeric' }
          )}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          const d = new Date(currentDate);
          if (view === 'month') d.setMonth(d.getMonth() + 1);
          else d.setDate(d.getDate() + 7);
          setCurrentDate(d);
        }}>{view === 'month' ? 'Next month' : 'Next week'} →</button>
      </div>

      {/* ── MONTH VIEW ─────────────────────────────────────────────────────── */}
      {view === 'month' && (() => {
        // Build full month grid
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells = [];
        // padding cells
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
        while (cells.length % 7 !== 0) cells.push(null);
        const weekHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        return (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Month header row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `1px solid ${G.border}`, background: G.bg2 }}>
              {weekHeaders.map(d => (
                <div key={d} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: G.text3, textTransform: 'uppercase', textAlign: 'center', borderRight: `1px solid ${G.border}` }}>{d}</div>
              ))}
            </div>
            {/* Grid rows */}
            {Array.from({ length: cells.length / 7 }, (_, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `1px solid ${G.border}` }}>
                {cells.slice(wi * 7, wi * 7 + 7).map((day, ci) => {
                  if (!day) return <div key={ci} style={{ minHeight: 90, background: G.bg2, borderRight: `1px solid ${G.border}` }} />;
                  const isToday = day.toDateString() === new Date().toDateString();
                  const isSun = day.getDay() === 0;
                  const isSat = day.getDay() === 6;
                  const dayTasks = tasks.filter(t => new Date(t.date).toDateString() === day.toDateString());
                  const isSelected = selectedMonthDate && day.toDateString() === selectedMonthDate.toDateString();
                  const dayEvents = calendarEvents.filter(e => new Date(e.start).toDateString() === day.toDateString());
                  return (
                    <div key={ci}
                      onClick={() => { setSelectedMonthDate(day); setCurrentDate(day); setView('day'); }}
                      style={{
                        minHeight: 90, padding: 6, borderRight: `1px solid ${G.border}`,
                        background: isToday ? G.blueBg : isSun ? '#f0fdf4' : isSat ? '#fefce8' : G.white,
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseOver={e => e.currentTarget.style.background = G.bg}
                      onMouseOut={e => e.currentTarget.style.background = isToday ? G.blueBg : isSun ? '#f0fdf4' : isSat ? '#fefce8' : G.white}
                    >
                      <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? G.blue : isSun ? G.green : isSat ? '#b45309' : G.text, marginBottom: 4 }}>
                        {day.getDate()}{isToday && ' ●'}
                      </div>
                      {dayEvents.map((e, ei) => (
                        <div key={ei} style={{ fontSize: 9, borderRadius: 3, padding: '1px 4px', marginBottom: 2, background: e.backgroundColor || G.amberBg, color: G.text, fontWeight: 600 }}>
                          {e.title}
                        </div>
                      ))}
                      {dayTasks.slice(0, 3).map((t, ti) => (
                        <div key={ti} style={{ fontSize: 10, borderRadius: 3, padding: '2px 5px', marginBottom: 2, background: t.priority === 'high' ? G.redBg : t.priority === 'medium' ? G.amberBg : G.blueBg, color: t.priority === 'high' ? G.red : t.priority === 'medium' ? G.amber : G.blue, borderLeft: `2px solid ${t.priority === 'high' ? G.red : t.priority === 'medium' ? G.amber : G.blue}`, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {t.startTime && <span style={{ opacity: 0.7 }}>{t.startTime}{t.endTime ? ` - ${t.endTime}` : ''} </span>}{t.title.slice(0, 20)}
                        </div>
                      ))}
                      {dayTasks.length > 3 && <div style={{ fontSize: 9, color: G.text3 }}>+{dayTasks.length - 3} more</div>}
                      {isSun && dayTasks.length === 0 && <div style={{ fontSize: 9, color: G.green, fontWeight: 600 }}>Enrichment ✨</div>}
                      {isSat && dayTasks.length === 0 && <div style={{ fontSize: 9, color: '#b45309', fontWeight: 600 }}>DSA + Study 📚</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── WEEK VIEW ──────────────────────────────────────────────────────── */}
      {view === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
          {getWeekDays().map((day, i) => {
            const dayTasks = tasks.filter(t => new Date(t.date).toDateString() === day.toDateString());
            const isToday  = day.toDateString() === new Date().toDateString();
            const isSunday = day.getDay() === 0;
            const isSaturday = day.getDay() === 6;
            const SUNDAY_ENRICHMENT = [
              { emoji: '🎯', label: 'LeetCode / DSA' },
              { emoji: '📚', label: 'Skill Building' },
              { emoji: '🚀', label: 'Side Project' },
              { emoji: '🎨', label: 'Hobby (2 hrs)' },
              { emoji: '🧠', label: 'Learn New Tech' },
            ];
            const HOLIDAY_ENRICHMENT = [
              { emoji: '🎯', label: 'Coding Practice' },
              { emoji: '📚', label: 'Skill Up' },
              { emoji: '🔨', label: 'Project Work' },
              { emoji: '🎨', label: 'Hobby & Rest' },
            ];
            const sunBg = isSunday ? '#f0fdf4' : isSaturday ? '#fefce8' : undefined;
            return (
              <div key={i} className="card" style={{ border: isToday ? `1.5px solid ${G.blue}` : isSunday ? `1.5px solid ${G.green}` : `1px solid ${G.border}`, overflow: 'hidden', background: sunBg }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${G.border}`, background: isToday ? G.blueBg : isSunday ? G.greenBg : 'transparent' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? G.blue : isSunday ? G.green : G.text3, textTransform: 'uppercase' }}>{DAYS[i]}</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: isToday ? G.blue : isSunday ? G.green : G.text }}>{day.getDate()}</div>
                </div>
                <div style={{ padding: 8 }}>
                  {/* Show regular tasks */}
                  {dayTasks.map((t, j) => (
                    <div key={j} style={{ padding: '5px 8px', borderRadius: 4, background: G.bg, marginBottom: 5, borderLeft: `2px solid ${priColor[t.priority] || G.text3}` }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: G.text, lineHeight: 1.3 }}>{t.title.split(' ').slice(0,4).join(' ')}{t.title.split(' ').length > 4 ? '…' : ''}</div>
                      <div style={{ fontSize: 10, color: G.text3, marginTop: 2 }}>{t.startTime}{t.endTime ? ` - ${t.endTime}` : ''}</div>
                    </div>
                  ))}
                  {/* Sunday enrichment chips */}
                  {isSunday && dayTasks.length === 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: G.green, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Enrichment Day ✨</div>
                      {SUNDAY_ENRICHMENT.map((item, k) => (
                        <div key={k} style={{ padding: '4px 6px', borderRadius: 4, background: G.greenBg, marginBottom: 3, border: `1px solid ${G.greenBd}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11 }}>{item.emoji}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: G.green }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Holiday enrichment chips (non-Sunday) */}
                  {!isSunday && dayTasks.length === 0 && isSaturday && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', marginBottom: 4 }}>Study + DSA Day 📚</div>
                      {['🎯 DSA Practice (1hr)','📖 Subject Revision (1hr)','🚀 Project / Skill (45m)'].map((s,k) => (
                        <div key={k} style={{ padding: '4px 6px', borderRadius: 4, background: '#fefce8', marginBottom: 3, border: '1px solid #fde68a', fontSize: 10, color: '#b45309' }}>{s}</div>
                      ))}
                    </div>
                  )}
                  {!isSunday && !isSaturday && dayTasks.length === 0 && (
                    <div style={{ fontSize: 11, color: G.text3, textAlign: 'center', padding: '8px 0' }}>Free</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DAY VIEW ───────────────────────────────────────────────────────── */}
      {view === 'day' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          {/* Task list */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: 11, color: G.text3 }}>{completed}/{todayTasks.length} tasks done</div>
              </div>
              {todayTasks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="progress-track" style={{ width: 80 }}>
                    <div className="progress-bar" style={{ width: `${todayTasks.length ? (completed/todayTasks.length)*100 : 0}%`, background: G.green }} />
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: G.text2 }}>{todayTasks.length ? Math.round((completed/todayTasks.length)*100) : 0}%</span>
                </div>
              )}
            </div>

            {todayTasks.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: G.text3 }}>No tasks for this day</div>
              </div>
            ) : (
              todayTasks.map((t) => (
                <div key={t._id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', borderBottom: `1px solid ${G.border}`, cursor: 'pointer', opacity: t.completed ? 0.5 : 1, transition: 'background 0.1s' }}
                  onMouseOver={e => e.currentTarget.style.background = G.bg}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <div className={`checkbox ${t.completed ? 'checked' : ''}`} style={{ marginTop: 1 }} onClick={() => toggleTask(t)}>
                    {t.completed && <Ic path={ICONS.check} size={9} color={G.white} sw={2.5} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: G.text, textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: G.text3, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, color: G.text2 }}>{t.category}</span>
                      {t.startTime && (
                        <span>
                          {t.startTime}{t.endTime ? ` – ${t.endTime}` : t.duration ? ` – ${(() => { const [h,m] = t.startTime.split(':').map(Number); const end = h*60+m+Math.round(t.duration/60); return `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`; })()}` : ''}
                        </span>
                      )}
                      {t.rollovers >= 2 && <span style={{ color: G.red, fontWeight: 700 }}>🚨 URGENT (missed {t.rollovers}x)</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span className="badge" style={{ background: priBg[t.priority], color: priColor[t.priority], border: `1px solid ${priBd[t.priority]}`, textTransform: 'capitalize' }}>{t.priority}</span>
                    {t.aiGenerated && <span className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}` }}>AI</span>}
                    {!t.completed && (
                      <button className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }} onClick={() => { setReasonTask(t); setReasonText(t.completionReason || ''); setShowReasonModal(true); }}>Why not done?</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px' }} onClick={() => deleteTask(t._id)}>
                      <Ic path={ICONS.trash} size={12} color={G.text3} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card card-md">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Weekly Summary</div>
              {[
                { label: 'Total tasks', val: `${tasks.length}` },
                { label: 'Completed',   val: `${tasks.filter(t => t.completed).length}` },
                { label: 'AI generated', val: `${tasks.filter(t => t.aiGenerated).length}` },
                { label: 'High priority', val: `${tasks.filter(t => t.priority === 'high').length}` },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${G.border}`, fontSize: 12 }}>
                  <span style={{ color: G.text2 }}>{label}</span>
                  <span className="mono" style={{ color: G.text, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
            <div className="card card-md">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Centralized Agent Runs</div>
              {orchestrationRuns.length === 0 ? (
                <div style={{ fontSize: 11, color: G.text3 }}>No orchestration runs yet.</div>
              ) : (
                orchestrationRuns.slice(0, 4).map((run) => (
                  <div key={run._id} style={{ fontSize: 11, color: G.text2, marginBottom: 8, borderBottom: `1px solid ${G.border}`, paddingBottom: 6 }}>
                    <div style={{ fontWeight: 600, color: G.text }}>
                      {new Date(run.runDate).toLocaleString()} • {run.trigger}
                    </div>
                    <div>mode: {run.mode} | burnout: {run?.burnout?.level || 'n/a'}</div>
                    <div>
                      shifted: {(run?.decisions?.overdueShifted || 0) + (run?.decisions?.capacityShifted || 0)} | DSA: {run?.decisions?.dsaTasksCreated || 0} | syllabus: {run?.decisions?.syllabusTasksCreated || 0}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="card card-md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Goal Risk</div>
                <span className="badge" style={{
                  background: risk.riskLevel === 'high' ? G.redBg : risk.riskLevel === 'medium' ? G.amberBg : G.greenBg,
                  color: risk.riskLevel === 'high' ? G.red : risk.riskLevel === 'medium' ? G.amber : G.green,
                  border: `1px solid ${risk.riskLevel === 'high' ? G.redBd : risk.riskLevel === 'medium' ? G.amberBd : G.greenBd}`,
                  textTransform: 'uppercase',
                }}>
                  {risk.riskLevel} ({risk.riskScore || 0})
                </span>
              </div>
              {(risk.reasons || []).length === 0 ? (
                <div style={{ fontSize: 11, color: G.text3 }}>No active risk signals.</div>
              ) : (
                (risk.reasons || []).map((item, idx) => (
                  <div key={idx} style={{ fontSize: 11, color: G.text2, marginBottom: 6 }}>
                    - {item}
                  </div>
                ))
              )}
            </div>
            <div className="card card-md">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Smart Timetable (7-day)</div>
              {timetable.length === 0 ? (
                <div style={{ fontSize: 11, color: G.text3 }}>
                  Click "Build Smart Timetable" to generate non-college-hour adaptive schedule.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: `1px solid ${G.border}`, borderRadius: 8 }}>
                  <div style={{ minWidth: 840 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', borderBottom: `1px solid ${G.border}`, background: G.bg2 }}>
                      <div style={{ padding: 8, fontSize: 10, color: G.text3, fontWeight: 700 }}>TIME</div>
                      {timetable.slice(0, 7).map((day) => (
                        <div key={day.date} style={{ padding: 8, borderLeft: `1px solid ${G.border}` }}>
                          <div style={{ fontSize: 10, color: G.text3 }}>{day.date}</div>
                          <div style={{ fontSize: 10, color: G.text, fontWeight: 700, textTransform: 'capitalize' }}>{day.mode}</div>
                          {getConflictsForDay(day).length > 0 && (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 9,
                                color: G.red,
                                background: G.redBg,
                                border: `1px solid ${G.redBd}`,
                                borderRadius: 999,
                                padding: '1px 6px',
                                display: 'inline-block',
                              }}
                            >
                              {getConflictsForDay(day).length} conflict
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', minHeight: 980 }}>
                      <div style={{ borderRight: `1px solid ${G.border}` }}>
                        {TIMELINE_HOURS.map((hour) => (
                          <div key={hour} style={{ height: 54, fontSize: 10, color: G.text3, padding: '2px 6px', borderTop: `1px dashed ${G.border}` }}>
                            {String(hour).padStart(2, '0')}:00
                          </div>
                        ))}
                      </div>
                      {timetable.slice(0, 7).map((day) => (
                        <div
                          key={day.date}
                          style={{ position: 'relative', borderLeft: `1px solid ${G.border}`, background: day.holidayToday ? G.greenBg : G.white }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={async (e) => {
                            e.preventDefault();
                            if (!draggingSlot || !draggingDay || draggingSlot.type !== 'task' || !draggingSlot.taskId) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const pxPerMinute = 0.9;
                            const minuteOffset = Math.max(0, Math.round(y / pxPerMinute));
                            const targetStartMin = 6 * 60 + minuteOffset;
                            const durationMin = Math.max(30, toMinutes(draggingSlot.endTime) - toMinutes(draggingSlot.startTime));
                            await moveTaskInTimetable({
                              taskId: draggingSlot.taskId,
                              targetDate: day.date,
                              targetStartMin,
                              durationMin,
                            });
                            setDraggingSlot(null);
                            setDraggingDay(null);
                          }}
                        >
                          {TIMELINE_HOURS.map((hour) => (
                            <div key={`${day.date}_${hour}`} style={{ height: 54, borderTop: `1px dashed ${G.border}` }} />
                          ))}
                          {(day.timeline || []).map((slot, idx) => {
                            const box = timelineBlockStyle(slot);
                            const theme = slotTheme(slot.type, slot.priority);
                            return (
                              <div
                                key={`${day.date}_${idx}`}
                                title={slot.explanation || slot.title}
                                draggable={slot.type === 'task'}
                                onDragStart={() => {
                                  setDraggingSlot(slot);
                                  setDraggingDay(day.date);
                                }}
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setSelectedDay(day);
                                }}
                                style={{
                                  position: 'absolute',
                                  left: 4,
                                  right: 4,
                                  top: box.top,
                                  minHeight: box.height,
                                  borderRadius: 6,
                                  border: `1px solid ${theme.border}`,
                                  background: theme.bg,
                                  color: theme.color,
                                  padding: '4px 6px',
                                  overflow: 'hidden',
                                  fontSize: 10,
                                  lineHeight: 1.2,
                                  cursor: slot.type === 'task' ? 'grab' : 'default',
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>{slot.startTime}-{slot.endTime}</div>
                                <div>{slot.title}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="card card-md">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Why Tasks Moved</div>
              {tasks.filter(t => t.movedReason).slice(0, 5).map((t) => (
                <div key={t._id} style={{ fontSize: 11, color: G.text2, marginBottom: 8 }}>
                  <div style={{ color: G.text, fontWeight: 600 }}>{t.title}</div>
                  <div>{t.movedByAgent || 'planner'}: {t.movedReason}</div>
                </div>
              ))}
              {tasks.filter(t => t.movedReason).length === 0 && (
                <div style={{ fontSize: 11, color: G.text3 }}>No recent agent-driven shifts.</div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Add Task Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', animation: 'fadeSlideUp 0.2s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Add New Task</div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Study Chapter 5" /></div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Date</label><input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="field-label">Start Time</label><input className="input" type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} /></div>
              <div><label className="field-label">End Time</label><input className="input" type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="field-label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTask} disabled={saving}>{saving ? <><Spinner /> Saving…</> : 'Add Task'}</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {showAI && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 440, animation: 'fadeSlideUp 0.2s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>🤖 AI Career Planner Sync</div>
            <div style={{ fontSize: 12, color: G.text2, marginBottom: 20 }}>Dynamically schedule your AI Career Roadmap phases across your daily calendar. Our Burnout Predictor actively throttles daily tasks if the load becomes unsafe.</div>
            
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Select Target Role to Sync</label>
              <select className="input" value={syncRole} onChange={e => setSyncRole(e.target.value)}>
                {profileRoles.length === 0 ? <option value="">No roles found in profile</option> : null}
                {profileRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAI(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generateAI} disabled={generating || profileRoles.length === 0}>{generating ? <><Spinner /> Syncing…</> : '🚀 Sync Auto-Schedule'}</button>
            </div>
          </div>
        </div>
      )}

      {showCalendarModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 460 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Add Academic Calendar</div>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Event Type</label>
              <select
                className="input"
                value={calendarForm.type}
                onChange={(e) => setCalendarForm({ ...calendarForm, type: e.target.value })}
              >
                {['Exam', 'SlipTest', 'Holiday', 'Seminar'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Dates (comma-separated YYYY-MM-DD)</label>
              <input
                className="input"
                value={calendarForm.dates.join(',')}
                onChange={(e) => setCalendarForm({ ...calendarForm, dates: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) })}
                placeholder="2026-05-02,2026-05-10"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowCalendarModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitCalendar}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showPrefsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚙️ Planner Preferences</div>
            <div style={{ fontSize: 11, color: G.text2, marginBottom: 16, padding: '8px 10px', background: G.blueBg, borderRadius: 6, border: `1px solid ${G.blueBd}` }}>
              📌 <strong>College student default:</strong> Study session is set to <strong>7pm–11pm</strong> (after college hours).
              Change Comfort Start/End to fit your schedule. Changes are saved to your profile.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['wakeTime',        'Wake Time'],
                ['sleepTime',       'Sleep Time'],
                ['dinnerTime',      'Dinner Time'],
                ['comfortableStart','Study Session Start (default 7pm)'],
                ['comfortableEnd',  'Study Session End (default 11pm)'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="field-label">{label}</label>
                  <input className="input" type="time" value={prefs[key]} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="field-label">Hobbies (comma-separated)</label>
              <input className="input" value={prefs.hobbies} onChange={(e) => setPrefs({ ...prefs, hobbies: e.target.value })} placeholder="music, reading, sports, gaming" />
              <div style={{ fontSize: 10, color: G.text3, marginTop: 3 }}>Hobbies appear in your Sunday enrichment schedule and daily hobby block.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowPrefsModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await savePlannerConstants({
                    planningMode,
                    ...prefs,
                    hobbies: prefs.hobbies.split(',').map((h) => h.trim()).filter(Boolean),
                  });
                  setShowPrefsModal(false);
                  fetchPlannerMeta(); // refresh from MongoDB
                }}
              >
                💾 Save to Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {showReasonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="card card-lg" style={{ width: 460 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Mark task complete?</div>
            <div style={{ fontSize: 12, color: G.text2, marginBottom: 12 }}>
              Add a note for why this task was not completed. Repeated patterns are used by the planner for burnout-aware adjustments.
            </div>
            <textarea
              className="input"
              rows={4}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Optional: What blocked this task or what changed?"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowReasonModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => submitTaskReason(false)}>Save reason</button>
            </div>
          </div>
        </div>
      )}

      {selectedSlot && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 360, height: '100vh', background: G.white, borderLeft: `1px solid ${G.border}`, zIndex: 1200, padding: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Task Details</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSlot(null)}>Close</button>
          </div>
          <div style={{ fontSize: 12, color: G.text2, marginBottom: 4 }}>Date</div>
          <div style={{ fontSize: 13, color: G.text, marginBottom: 10 }}>{selectedDay?.date}</div>
          <div style={{ fontSize: 12, color: G.text2, marginBottom: 4 }}>Title</div>
          <div style={{ fontSize: 13, color: G.text, marginBottom: 10 }}>{selectedSlot.title}</div>
          <div style={{ fontSize: 12, color: G.text2, marginBottom: 4 }}>Time</div>
          <div style={{ fontSize: 13, color: G.text, marginBottom: 10 }}>{selectedSlot.startTime} - {selectedSlot.endTime}</div>
          {selectedSlot.priority && (
            <>
              <div style={{ fontSize: 12, color: G.text2, marginBottom: 4 }}>Priority</div>
              <div style={{ fontSize: 13, color: G.text, marginBottom: 10, textTransform: 'capitalize' }}>{selectedSlot.priority}</div>
            </>
          )}
          {selectedSlot.explanation && (
            <>
              <div style={{ fontSize: 12, color: G.text2, marginBottom: 4 }}>Why this slot?</div>
              <div style={{ fontSize: 12, color: G.text, marginBottom: 14 }}>{selectedSlot.explanation}</div>
            </>
          )}

          {selectedSlot.type === 'task' && selectedSlot.taskId && (
            <>
              <div style={{ fontSize: 12, color: G.text2, marginBottom: 8 }}>Quick Reschedule</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    const start = toMinutes(selectedSlot.startTime) + 30;
                    const duration = Math.max(30, toMinutes(selectedSlot.endTime) - toMinutes(selectedSlot.startTime));
                    await moveTaskInTimetable({
                      taskId: selectedSlot.taskId,
                      targetDate: selectedDay?.date,
                      targetStartMin: start,
                      durationMin: duration,
                    });
                  }}
                >
                  +30 min
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    const start = toMinutes(selectedSlot.startTime);
                    const duration = Math.max(30, toMinutes(selectedSlot.endTime) - toMinutes(selectedSlot.startTime));
                    const nextDate = new Date(`${selectedDay?.date}T00:00:00`);
                    nextDate.setDate(nextDate.getDate() + 1);
                    await moveTaskInTimetable({
                      taskId: selectedSlot.taskId,
                      targetDate: nextDate.toISOString().slice(0, 10),
                      targetStartMin: start,
                      durationMin: duration,
                    });
                  }}
                >
                  Next day
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: G.text3 }}>
                Tip: Drag this block to another time/day in the timetable grid.
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}