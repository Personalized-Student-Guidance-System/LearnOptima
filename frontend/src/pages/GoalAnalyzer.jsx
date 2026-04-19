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
  const [form, setForm] = useState({ title: '', description: '', category: 'skill', deadline: '', progress: 0, linkedSkill: '' });
  const [profile, setProfile] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);

  useEffect(() => { 
    fetchGoals(); 
    axios.get('/profile').then(res => setProfile(res.data)).catch(() => {});
  }, []);

  const fetchGoals = async () => {
    try { const res = await axios.get('/goals'); setGoals(res.data); } catch {}
  };

  const addGoal = async (overrideForm = null) => {
    setSaving(true);
    try {
      await axios.post('/goals', overrideForm || form);
      setShowModal(false);
      setForm({ title: '', description: '', category: 'skill', deadline: '', progress: 0, linkedSkill: '' });
      fetchGoals();
    } catch {} finally { setSaving(false); }
  };

  const updateGoal = async (goal, updates) => {
    try { await axios.put(`/goals/${goal._id}`, updates); fetchGoals(); } catch {}
  };

  const openAutoGenerate = async () => {
    setShowAutoGenerate(true);
    if (!roadmap && profile?.targetRole) {
      setLoadingRoadmap(true);
      try {
        const res = await axios.get(`/career/personalized?role=${encodeURIComponent(profile.targetRole)}`);
        setRoadmap(res.data.phases || []);
      } catch {} finally { setLoadingRoadmap(false); }
    }
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
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Set goals, track progress, and map skills automatically</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={openAutoGenerate}><Ic path={ICONS.refresh} size={12} /> Auto-Import Roadmap</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Ic path={ICONS.plus} size={12} /> New Goal</button>
        </div>
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
                    {goal.source === 'auto' && <Badge label="Roadmap" color="purple" />}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{goal.title}</div>
                      {goal.linkedSkill && <div style={{ fontSize: 11, color: G.blue, marginTop: 2, fontWeight: 600 }}>🔗 Maps to: {goal.linkedSkill}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    
                    <select className="input" value={goal.status || 'not_started'} onChange={e => {
                      const st = e.target.value;
                      const updates = { status: st };
                      if (st === 'completed') updates.progress = 100;
                      updateGoal(goal, updates);
                    }} style={{ fontSize: 11, padding: '4px 8px', height: 28, minWidth: 110 }}>
                      <option value="not_started">Status: Not Started</option>
                      <option value="in_progress">Status: In Progress</option>
                      <option value="stuck">Status: Stuck ⚠️</option>
                      <option value="completed">Status: Completed ✅</option>
                    </select>

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
                  <div style={{ fontSize: 11, color: G.text3, flexShrink: 0 }}>
                     Deadline: <input type="date" value={goal.deadline ? goal.deadline.split('T')[0] : ''} onChange={e => updateGoal(goal, { deadline: e.target.value })} style={{ border: 'none', background: 'transparent', outline: 'none', color: G.text2, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }} />
                  </div>
                  <div className="progress-track" style={{ flex: 1, height: 6 }}>
                    <div className="progress-bar" style={{ width: `${goal.progress}%`, background: goal.progress === 100 ? G.green : (catRaw[goal.category] || G.blue) }} />
                  </div>
                  <input type="range" min="0" max="100" value={goal.progress}
                    onChange={e => updateGoal(goal, { progress: Number(e.target.value), status: Number(e.target.value) === 100 ? 'completed' : 'in_progress' })}
                    style={{ position: 'absolute', opacity: 0, width: 'calc(100% - 200px)', cursor: 'pointer', right: 50 }} />
                  <span className="mono" style={{ fontSize: 12, color: G.text2, flexShrink: 0, width: 35, textAlign: 'right' }}>{goal.progress}%</span>
                </div>
              </div>

              {goal.aiAnalysis && (
                <div style={{ padding: '16px 20px', background: G.bg, borderTop: `1px solid ${G.border}`, animation: 'slideDown 0.2s ease' }}>
                  
                  {/* High Level Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Est. Timeline', val: goal.aiDetails?.estTimeline || 'Pending' },
                      { label: 'Difficulty',    val: goal.aiDetails?.difficulty || 'Pending' },
                      { label: 'Skills Needed', val: goal.aiDetails?.skillsNeeded || 'Pending' },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ padding: '10px 12px', borderRadius: 6, background: G.white, border: `1px solid ${G.border}` }}>
                        <div style={{ fontSize: 10, color: G.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 13, color: G.text2, lineHeight: 1.6, marginBottom: 16 }}>
                    <span style={{ fontSize: 14 }}>💡</span> {goal.aiAnalysis}
                  </div>

                  {goal.aiDetails && goal.aiDetails.missingSkills && goal.aiDetails.missingSkills.length > 0 && (
                    <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase' }}>Missing Skills (Add to Learn Queue)</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {goal.aiDetails.missingSkills.map(missing => (
                          <div key={missing} style={{ display: 'flex', alignItems: 'center', gap: 6, background: G.white, border: `1px solid ${G.border}`, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            {missing}
                            <button
                              onClick={async (e) => {
                                e.target.innerText = 'Added ✓';
                                e.target.disabled = true;
                                try {
                                  const { data } = await axios.get('/profile');
                                  const cur = data.skills || [];
                                  await axios.put('/profile', { skills: [...new Set([...cur, missing])] });
                                  fetchGoals(); // trigger a re-render/analysis recalculation later if needed
                                } catch {}
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: G.blue, fontSize: 11, padding: 0, fontWeight: 700 }}>
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Courses & Action Plan */}
                  {goal.aiDetails && goal.aiDetails.courses && goal.aiDetails.courses.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
                        <div style={{ padding: '12px 16px', background: G.white, borderRadius: 8, border: `1px solid ${G.border}` }}>
                          <h4 style={{ fontSize: 12, fontWeight: 700, color: G.purple, margin: '0 0 10px', textTransform: 'uppercase' }}>Recommended Courses</h4>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: G.text2, lineHeight: 1.6 }}>
                            {goal.aiDetails.courses.map((c, idx) => <li key={idx} style={{ marginBottom: 4 }}>{c}</li>)}
                          </ul>
                        </div>
                      
                        <div style={{ padding: '12px 16px', background: G.white, borderRadius: 8, border: `1px solid ${G.border}` }}>
                          <h4 style={{ fontSize: 12, fontWeight: 700, color: G.blue, margin: '0 0 10px', textTransform: 'uppercase' }}>Action Plan Milestones</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: G.text2 }}>
                            {goal.milestones && goal.milestones.length > 0 ? goal.milestones.map((m, idx) => (
                              <label key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.completed} onChange={async (e) => {
                                  const c = e.target.checked;
                                  const nw = [...goal.milestones];
                                  nw[idx] = { ...nw[idx], completed: c };
                                  const progVal = Math.round((nw.filter(x => x.completed).length / nw.length) * 100);
                                  try { await axios.put(`/goals/${goal._id}`, { milestones: nw, progress: progVal }); fetchGoals(); } catch {}
                                }} style={{ marginTop: 2 }} />
                                <span style={{ textDecoration: m.completed ? 'line-through' : 'none', color: m.completed ? G.text3 : G.text2 }}>{m.title}</span>
                              </label>
                            )) : (
                              goal.aiDetails.plan?.map((p, idx) => <div key={idx} style={{ marginBottom: 4 }}>• {p}</div>)
                            )}
                          </div>
                        </div>
                    </div>
                  )}

                  {/* Progress Tracking Timeline */}
                  {goal.progressHistory && goal.progressHistory.length > 1 && (
                    <div style={{ marginTop: 16, padding: '12px 16px', background: G.white, borderRadius: 8, border: `1px solid ${G.border}` }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: G.text, margin: '0 0 10px', textTransform: 'uppercase' }}>Progress Tracking: Improvement Over Time</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40, borderBottom: `1px solid ${G.border2}`, position: 'relative' }}>
                        {goal.progressHistory.map((h, i, arr) => {
                          const w = 100 / (arr.length - 1 || 1);
                          if (i === 0) return null;
                          const prev = arr[i - 1].progress;
                          const curr = h.progress;
                          const goingUp = curr >= prev;
                          return (
                            <div key={i} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                              <div style={{ position: 'absolute', bottom: `${prev}%`, left: 0, right: '-10%', height: 2, background: goingUp ? G.green : G.amber, transformOrigin: 'left bottom', transform: `rotate(${Math.atan2(curr - prev, 100) * -1}rad)` }} />
                              <div style={{ position: 'absolute', bottom: `${curr}%`, right: '-4px', width: 8, height: 8, borderRadius: '50%', background: goingUp ? G.green : G.amber, border: `2px solid ${G.white}`, zIndex: 2 }} title={`${curr}% on ${new Date(h.date).toLocaleDateString()}`} />
                              <span style={{ position: 'absolute', bottom: -20, right: -10, fontSize: 9, color: G.text3 }}>{new Date(h.date).toLocaleDateString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Auto-Generate Goal Drawer */}
      {showAutoGenerate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div className="card" style={{ width: 400, height: '100%', margin: 0, borderRadius: 0, animation: 'slideRight 0.3s ease', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: `1px solid ${G.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Auto-Import Roadmap Tasks</div>
                <button className="btn btn-ghost" onClick={() => setShowAutoGenerate(false)}>✕</button>
              </div>
              <p style={{ fontSize: 12, color: G.text2, marginTop: 4 }}>Turn required roadmap skills directly into daily actionable goals.</p>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {loadingRoadmap ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spinner /><div style={{ fontSize: 12, color: G.text3, marginTop: 10 }}>Scanning Roadmap...</div></div>
              ) : !roadmap || roadmap.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: 12, color: G.text2 }}>No roadmap available. Please set your Target Role in setup.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {roadmap.map((phase, pidx) => (
                    <div key={pidx}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 8 }}>{phase.title}</div>
                      {phase.resources?.map((res, ridx) => (
                        <div key={ridx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: G.bg, padding: '8px 12px', borderRadius: 6, marginBottom: 6, border: `1px solid ${G.border2}` }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>Master {res.skill}</div>
                            <div style={{ fontSize: 10, color: G.text3 }}>Type: {res.tier}</div>
                          </div>
                          <button className="btn btn-primary btn-sm" onClick={() => {
                            // Add 3 weeks from now as soft deadline
                            const d = new Date(); d.setDate(d.getDate() + 21);
                            addGoal({
                              title: `Master ${res.skill}`, description: `Imported from Career Roadmap: ${phase.title}`,
                              category: 'skill', deadline: d.toISOString().split('T')[0], progress: 0, source: 'auto', linkedSkill: res.skill
                            });
                          }}>+ Import</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Goal Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 480, animation: 'fadeSlideUp 0.2s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>New Goal</div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Master Node.js" /></div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Description</label><textarea className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} style={{ resize: 'vertical' }} /></div>
            <div style={{ marginBottom: 12 }}><label className="field-label">Linked Skill (Optional)</label><input className="input" value={form.linkedSkill} onChange={e => setForm({...form, linkedSkill: e.target.value})} placeholder="e.g. Node.js (auto-added to profile on completion)" /></div>
            
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
              <button className="btn btn-primary" onClick={() => addGoal()} disabled={saving}>{saving ? <><Spinner /> Saving…</> : 'Create Goal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}