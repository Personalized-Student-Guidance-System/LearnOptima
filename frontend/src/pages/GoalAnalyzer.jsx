import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Ic, Badge, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const CATEGORIES = ['academic', 'skill', 'career', 'personal'];
const catColor   = { academic: 'green', skill: 'amber', career: 'blue', personal: 'purple' };
const catRaw     = { academic: G.green, skill: G.amber, career: G.blue, personal: G.purple };

export default function GoalAnalyzer() {
  const [goals,     setGoals]     = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'academic', deadline: '', progress: 0 });

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    try { const res = await axios.get('/goals'); setGoals(res.data); } catch {}
  };

  const addGoal = async () => {
    setSaving(true);
    try {
      await axios.post('/goals', form);
      setShowModal(false);
      setForm({ title: '', description: '', category: 'academic', deadline: '', progress: 0 });
      fetchGoals();
    } catch {} finally { setSaving(false); }
  };

  const updateProgress = async (goal, progress) => {
    try { await axios.put(`/goals/${goal._id}`, { progress }); fetchGoals(); } catch {}
  };

  const analyze = async (goal) => {
    setAnalyzing(goal._id);
    try { await axios.post(`/goals/${goal._id}/analyze`); fetchGoals(); } catch {} finally { setAnalyzing(null); }
  };

  const deleteGoal = async (id) => {
    try { await axios.delete(`/goals/${id}`); fetchGoals(); } catch {}
  };

  const stats = {
    total:    goals.length,
    active:   goals.filter(g => g.status === 'active').length,
    avgProg:  goals.length ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : 0,
    completed: goals.filter(g => g.status === 'completed').length,
  };

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Goal Tracker</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Set goals and get AI-generated analysis and action plans</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Ic path={ICONS.plus} size={12} /> New Goal</button>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Active Goals',  val: stats.active },
          { label: 'Avg Progress',  val: `${stats.avgProg}%` },
          { label: 'Near Deadline', val: '2' },
          { label: 'Completed',     val: stats.completed },
        ].map(({ label, val }) => (
          <div key={label} className="card card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: G.text2 }}>{label}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: G.text }}>{val}</span>
          </div>
        ))}
      </div>

      {goals.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: G.text, marginBottom: 6 }}>No goals yet</div>
          <div style={{ fontSize: 12, color: G.text3, marginBottom: 16 }}>Create your first goal to get started</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Ic path={ICONS.plus} size={12} /> New Goal</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {goals.map((goal, i) => (
            <div key={goal._id} className="card" style={{ overflow: 'hidden', animation: `fadeSlideUp 0.3s ${i*0.06}s both` }}>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Badge label={goal.category} color={catColor[goal.category] || 'default'} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{goal.title}</div>
                      {goal.deadline && <div style={{ fontSize: 11, color: G.text3, marginTop: 2 }}>Target: {new Date(goal.deadline).toLocaleDateString()}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => analyze(goal)} disabled={analyzing === goal._id}>
                      {analyzing === goal._id ? <><Spinner color={G.text2} size={10} /> Analyzing</> : 'AI Analysis'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }} onClick={() => deleteGoal(goal._id)}>
                      <Ic path={ICONS.trash} size={12} color={G.text3} />
                    </button>
                  </div>
                </div>

                {goal.description && <p style={{ fontSize: 12, color: G.text2, marginBottom: 12 }}>{goal.description}</p>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="progress-track" style={{ flex: 1 }}>
                    <div className="progress-bar" style={{ width: `${goal.progress}%`, background: catRaw[goal.category] || G.blue }} />
                  </div>
                  <input type="range" min="0" max="100" value={goal.progress}
                    onChange={e => updateProgress(goal, Number(e.target.value))}
                    style={{ position: 'absolute', opacity: 0, width: 'calc(100% - 100px)', cursor: 'pointer' }} />
                  <span className="mono" style={{ fontSize: 12, color: G.text2, flexShrink: 0 }}>{goal.progress}%</span>
                </div>
              </div>

              {goal.aiAnalysis && (
                <div style={{ padding: '16px 20px', background: G.bg, borderTop: `1px solid ${G.border}`, animation: 'slideDown 0.2s ease' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Est. Timeline', val: '6 months' },
                      { label: 'Difficulty',    val: 'Medium–High' },
                      { label: 'Skills Needed', val: '8 skills' },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ padding: '10px 12px', borderRadius: 6, background: G.white, border: `1px solid ${G.border}` }}>
                        <div style={{ fontSize: 10, color: G.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: G.text2, lineHeight: 1.6, padding: '10px 12px', background: G.white, borderRadius: 6, border: `1px solid ${G.border}` }}>
                    🤖 {goal.aiAnalysis}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 480, animation: 'fadeSlideUp 0.2s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>New Goal</div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Become a Data Scientist" /></div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Description</label><textarea className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} style={{ resize: 'vertical' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="field-label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="field-label">Deadline</label><input className="input" type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addGoal} disabled={saving}>{saving ? <><Spinner /> Saving…</> : 'Create Goal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}