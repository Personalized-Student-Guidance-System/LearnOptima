import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  const [form, setForm] = useState({ title: '', date: '', startTime: '', endTime: '', category: 'study', priority: 'medium', description: '' });
  const [profileRoles, setProfileRoles] = useState([]);
  const [syncRole, setSyncRole] = useState('');

  useEffect(() => { 
    fetchTasks(); 
    axios.get('/profile').then(res => {
      const roles = res.data?.targetRoles || (res.data?.targetRole ? [res.data.targetRole] : []);
      setProfileRoles(roles);
      if (roles.length > 0) setSyncRole(roles[0]);
    }).catch(()=>{});
  }, [currentDate]);

  const fetchTasks = async () => {
    try {
      const start = new Date(currentDate); start.setDate(start.getDate() - 30);
      const end   = new Date(currentDate); end.setDate(end.getDate() + 30);
      const res = await axios.get(`/planner?start=${start.toISOString()}&end=${end.toISOString()}`);
      setTasks(res.data);
    } catch {}
  };

  const addTask = async () => {
    setSaving(true);
    try {
      await axios.post('/planner', form);
      setShowModal(false);
      setForm({ title: '', date: '', startTime: '', endTime: '', category: 'study', priority: 'medium', description: '' });
      fetchTasks();
    } catch {} finally { setSaving(false); }
  };

  const toggleTask = async (task) => {
    try {
      await axios.put(`/planner/${task._id}`, { completed: !task.completed });
      fetchTasks();
    } catch {}
  };

  const deleteTask = async (id) => {
    try { await axios.delete(`/planner/${id}`); fetchTasks(); } catch {}
  };

  const generateAI = async () => {
    if (!syncRole) return alert('Please define a Target Role in your Profile first.');
    setGenerating(true);
    try {
      await axios.post('/planner/sync-roadmap', { role: syncRole });
      setShowAI(false); 
      fetchTasks();
    } catch (err) { 
        alert('Failed to generate. Please ensure you have visited the Career Roadmap page at least once to cache the AI pipeline for this role.'); 
    } finally { 
        setGenerating(false); 
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
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Smart Planner</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>AI-generated study plans based on your goals and schedule</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
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
            const dayTasks = tasks.filter(t => new Date(t.date).toDateString() === day.toDateString());
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
                      <div style={{ fontSize: 10, color: G.text3, marginTop: 2 }}>{t.startTime}</div>
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
    </div>
  );
}