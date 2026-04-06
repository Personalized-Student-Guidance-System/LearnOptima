import React, { useState, useEffect } from 'react';
import { getTasks, createTask, updateTask, deleteTask as deleteTaskAPI, generateAIPLan } from '../services/api';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PRIORITIES = ['low', 'medium', 'high'];
const CATEGORIES = ['study', 'assignment', 'project', 'exam', 'personal', 'other'];

const priColor = { high: G.red, medium: G.amber, low: G.text3 };
const priBg    = { high: G.redBg, medium: G.amberBg, low: G.bg2 };
const priBd    = { high: G.redBd, medium: G.amberBd, low: G.border };

export default function Planner() {
  const [view,       setView]       = useState('day');
  const [tasks,      setTasks]      = useState([]);
  const [generating, setGenerating] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [showAI,     setShowAI]     = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ 
    title: '', 
    date: new Date().toISOString().split('T')[0], // Default to today
    startTime: '', 
    endTime: '', 
    category: 'study', 
    priority: 'medium', 
    description: '' 
  });
  const [aiForm, setAiForm] = useState({ subjects: '', examDate: '', hoursPerDay: 4 });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => { fetchTasks(); }, [currentDate]);

  const fetchTasks = async () => {
    try {
      const start = new Date(currentDate); start.setDate(start.getDate() - 30);
      const end   = new Date(currentDate); end.setDate(end.getDate() + 30);
      const res = await getTasks({ start: start.toISOString(), end: end.toISOString() });
      setTasks(res.data);
    } catch {}
  };

  const addTask = async () => {
    if (!form.title.trim() || !form.date) {
      alert('Please fill in the title and date');
      return;
    }
    setSaving(true);
    try {
      await createTask(form);
      setShowModal(false);
      setForm({ 
        title: '', 
        date: new Date().toISOString().split('T')[0], 
        startTime: '', 
        endTime: '', 
        category: 'study', 
        priority: 'medium', 
        description: '' 
      });
      fetchTasks();
    } catch (err) {
      console.error('Error adding task:', err);
      alert('Failed to add task. Please try again.');
    } finally { setSaving(false); }
  };

  const toggleTask = async (task) => {
    try {
      await updateTask(task._id, { completed: !task.completed });
      fetchTasks();
    } catch {}
  };

  const deleteTask = async (id) => {
    try { await deleteTaskAPI(id); fetchTasks(); } catch {}
  };

  const clearCompleted = async () => {
    const completedTasks = todayTasks.filter(t => t.completed);
    for (const task of completedTasks) {
      await deleteTaskAPI(task._id);
    }
    fetchTasks();
  };
  

  const generateAI = async () => {
    setGenerating(true);
    setError('');
    try {
      await generateAIPLan({
        subjects: aiForm.subjects.split(',').map(s => s.trim()),
        examDate: aiForm.examDate,
        hoursPerDay: Number(aiForm.hoursPerDay)
      });
      setShowAI(false); fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate plan');
    } finally { setGenerating(false); }
  };

  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };

  const parseMinutes = (time = '') => {
    const [hours, mins] = time.split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(mins) ? hours * 60 + mins : null;
  };

  const todayTasks = tasks.filter(t => {
    const taskDate = new Date(t.date);
    return taskDate.getFullYear() === currentDate.getFullYear() && taskDate.getMonth() === currentDate.getMonth() && taskDate.getDate() === currentDate.getDate();
  });

  const visibleTasks = todayTasks.filter(t => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
  });

  const completed  = visibleTasks.filter(t => t.completed).length;
  const remaining  = visibleTasks.filter(t => !t.completed).length;

  const totalMinutes = visibleTasks.reduce((sum, task) => {
    const start = parseMinutes(task.startTime);
    const end = parseMinutes(task.endTime);
    return sum + (start !== null && end !== null && end > start ? end - start : 0);
  }, 0);

  const todayHoursPlanned = Math.round((totalMinutes / 60) * 10) / 10;
  const suggestedTask = visibleTasks.find(t => !t.completed && t.priority === 'high') || visibleTasks.find(t => !t.completed) || visibleTasks[0] || null;

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Smart Planner</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>AI-generated study plans based on your goals and schedule</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['all', 'high', 'medium', 'low'].map(level => (
              <button
                key={level}
                onClick={() => setPriorityFilter(level)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  border: 'none',
                  cursor: 'pointer',
                  background: priorityFilter === level ? G.white : G.bg2,
                  color: priorityFilter === level ? G.text : G.text2,
                  fontFamily: "'Plus Jakarta Sans'",
                  fontWeight: 600,
                  fontSize: 12,
                  boxShadow: priorityFilter === level ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize'
                }}
              >
                {level}
              </button>
            ))}
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Ic path={ICONS.filter} size={14} color={G.text3} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px',
                borderRadius: 6,
                border: `1px solid ${G.border}`,
                background: G.white,
                fontSize: 13,
                color: G.text,
                width: 200,
                outline: 'none'
              }}
            />
          </div>
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
          <button className="btn btn-ghost btn-sm" onClick={clearCompleted} disabled={completed === 0}>
            <Ic path={ICONS.trash} size={12} /> Clear Completed
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Ic path={ICONS.plus} size={12} /> New Task
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}>← Prev week</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}>Next week →</button>
      </div>

      {view === 'week' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
          {getWeekDays().map((day, i) => {
            const dayTasks = tasks.filter(t => {
  const taskDate = new Date(t.date);
  return (
    taskDate.getFullYear() === day.getFullYear() &&
    taskDate.getMonth() === day.getMonth() &&
    taskDate.getDate() === day.getDate()
  );
});
            const isToday  = day.toDateString() === new Date().toDateString();
            return (
              <div key={i} className="card" style={{ border: isToday ? `1.5px solid ${G.blue}` : `1px solid ${G.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${G.border}`, background: isToday ? G.blueBg : 'transparent' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? G.blue : G.text3, textTransform: 'uppercase' }}>{DAYS[i]}</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: isToday ? G.blue : G.text }}>{day.getDate()}</div>
                </div>
                <div style={{ padding: 8 }}>
                  {dayTasks.map((t, j) => (
                    <div key={j} style={{ padding: '5px 8px', borderRadius: 4, background: G.bg, marginBottom: 5, borderLeft: `2px solid ${priColor[t.priority]}` }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: G.text, lineHeight: 1.3 }}>{t.title.split(' ').slice(0,4).join(' ')}{t.title.split(' ').length > 4 ? '…' : ''}</div>
                      <div style={{ fontSize: 9, color: G.text3 }}>
  {t.category}
</div>
                      <div style={{ fontSize: 10, color: G.text3, marginTop: 2 }}>
  {t.startTime} - {t.endTime} • {t.priority.toUpperCase()}
</div>
                    </div>
                  ))}
                  {dayTasks.length === 0 && <div style={{ fontSize: 11, color: G.text3, textAlign: 'center', padding: '8px 0' }}>Free</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
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
      ) : view === 'month' ? (

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
          {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate() }, (_, i) => {
            const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
            const dayTasks = tasks.filter(t => new Date(t.date).toDateString() === day.toDateString());

            return (
              <div key={i} className="card" style={{ minHeight: 110, padding: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{day.getDate()}</div>

                {dayTasks.slice(0,3).map((t,j)=>(
                  <div key={j} style={{ fontSize: 10, marginBottom: 4, color: G.text3 }}>
                    • {t.title.slice(0,18)}
                  </div>
                ))}

                {dayTasks.length > 3 && (
                  <div style={{ fontSize: 10, color: G.text3 }}>+ more</div>
                )}
              </div>
            );
          })}
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
                    <div style={{ fontSize: 11, color: G.text3, marginTop: 3, display: 'flex', gap: 10 }}>
                      <span style={{ fontWeight: 500, color: G.text2 }}>{t.category}</span>
                      {t.startTime && <span>{t.startTime} – {t.endTime}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span className="badge" style={{ background: priBg[t.priority], color: priColor[t.priority], border: `1px solid ${priBd[t.priority]}`, textTransform: 'capitalize' }}>{t.priority}</span>
                    {t.aiGenerated && <span className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}` }}>AI</span>}
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
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Today's Progress</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div className="progress-bar" style={{ width: `${visibleTasks.length ? (completed/visibleTasks.length)*100 : 0}%`, background: completed === visibleTasks.length && visibleTasks.length > 0 ? G.green : G.blue }} />
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{completed}/{visibleTasks.length}</span>
              </div>
              <div style={{ fontSize: 11, color: G.text3, marginBottom: 10 }}>
                {completed === visibleTasks.length && visibleTasks.length > 0 ? 'All tasks completed! 🎉' : 
                 visibleTasks.length === 0 ? 'No tasks for today' : 
                 `${remaining} tasks remaining`}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: G.text3 }}>
                <div>{todayHoursPlanned}h planned</div>
                <div>{visibleTasks.filter(t => t.aiGenerated).length} AI tasks</div>
              </div>
            </div>
            {suggestedTask && (
              <div className="card card-md">
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Suggested Next Task</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: G.text, marginBottom: 8 }}>{suggestedTask.title}</div>
                <div style={{ fontSize: 11, color: G.text3, marginBottom: 10 }}>{suggestedTask.category} • {suggestedTask.priority}</div>
                {suggestedTask.startTime && suggestedTask.endTime && <div style={{ fontSize: 11, color: G.text3, marginBottom: 12 }}>{suggestedTask.startTime} - {suggestedTask.endTime}</div>}
                <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => toggleTask(suggestedTask)}>
                  {suggestedTask.completed ? 'Undo Complete' : 'Mark Complete'}
                </button>
              </div>
            )}
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
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', animation: 'fadeSlideUp 0.2s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Add New Task</div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Study Chapter 5" /></div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Date</label><input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Description (optional)</label><textarea className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Additional details..." rows={2} /></div>
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
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>🤖 AI Study Plan Generator</div>
            <div style={{ fontSize: 12, color: G.text2, marginBottom: 20 }}>Generate an optimized study schedule based on your subjects and exam date</div>
            {error && <div style={{ fontSize: 12, color: G.red, marginBottom: 12, padding: '8px 12px', background: G.redBg, border: `1px solid ${G.redBd}`, borderRadius: 4 }}>{error}</div>}
            <div style={{ marginBottom: 12 }}><label className="field-label">Subjects (comma-separated)</label><input className="input" value={aiForm.subjects} onChange={e => setAiForm({...aiForm, subjects: e.target.value})} placeholder="Math, Physics, Chemistry" /></div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Exam Date</label><input className="input" type="date" value={aiForm.examDate} onChange={e => setAiForm({...aiForm, examDate: e.target.value})} /></div>
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">Hours Per Day: {aiForm.hoursPerDay}</label>
              <div style={{ position: 'relative', height: 4, borderRadius: 99, background: G.bg2, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 99, background: G.blue, width: `${(aiForm.hoursPerDay / 12) * 100}%`, transition: 'width 0.2s' }} />
              </div>
              <input type="range" min={1} max={12} value={aiForm.hoursPerDay} onChange={e => setAiForm({...aiForm, hoursPerDay: Number(e.target.value)})} style={{ width: '100%', accentColor: G.blue, cursor: 'pointer', marginTop: -8 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAI(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generateAI} disabled={generating}>{generating ? <><Spinner /> Generating…</> : '🚀 Generate Plan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}