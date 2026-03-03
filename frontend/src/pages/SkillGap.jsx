import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Ic } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const urgencyColor = { Critical: G.red,    High: G.amber,    Medium: G.blue };
const urgencyBg    = { Critical: G.redBg,   High: G.amberBg,  Medium: G.blueBg };
const urgencyBd    = { Critical: G.redBd,   High: G.amberBd,  Medium: G.blueBd };

export default function SkillGap() {
  const { user } = useAuth();
  const [data,        setData]     = useState(null);
  const [selectedRole, setRole]    = useState('Software Engineer');
  const [newSkill,    setNewSkill] = useState('');
  const [userSkills,  setUserSkills] = useState(user?.skills || ['Python','Java','C','HTML','CSS','MySQL','Git','Data Structures']);
  const [loading,     setLoading]  = useState(false);

  useEffect(() => { analyze(); }, [selectedRole]);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/skills/gap-analysis?role=${encodeURIComponent(selectedRole)}`);
      setData(res.data);
    } catch {} finally { setLoading(false); }
  };

  const addSkill = async () => {
    if (!newSkill.trim()) return;
    const updated = [...userSkills, newSkill.trim()];
    setUserSkills(updated);
    try { await axios.put('/skills/update', { skills: updated }); } catch {}
    setNewSkill('');
    analyze();
  };

  const removeSkill = async (skill) => {
    const updated = userSkills.filter(s => s !== skill);
    setUserSkills(updated);
    try { await axios.put('/skills/update', { skills: updated }); } catch {}
    analyze();
  };

  const score = data?.matchScore || 0;
  const scoreColor = score >= 70 ? G.green : score >= 45 ? G.amber : G.red;

  const roles = data?.roles || ['Software Engineer','Data Scientist','Full Stack Developer','DevOps Engineer'];
  const matched = data?.matched || [];
  const missing = data?.missing || [];
  const required = data?.requiredSkills || [];

  const prioritized = missing.slice(0, 4).map((skill, i) => ({
    skill,
    urgency: i === 0 ? 'Critical' : i < 2 ? 'High' : 'Medium',
    time: ['3-4 weeks','4-6 weeks','2-3 weeks','6-8 weeks'][i],
    why: ['Core requirement for this role','Frequently tested in interviews','Used in 80% of job descriptions','Increasingly common requirement'][i],
  }));

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Skill Gap Analyzer</h1>
        <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Compare your current skills against industry requirements</p>
      </div>

      {/* Role selector */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: G.text2 }}>Target Role</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {roles.map(r => (
            <button key={r} onClick={() => setRole(r)} className="btn btn-sm" style={{ background: r === selectedRole ? G.text : G.white, color: r === selectedRole ? G.white : G.text, border: `1px solid ${r === selectedRole ? G.text : G.border}` }}>{r}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: G.text2 }}>Your skills:</span>
          {userSkills.slice(0, 4).map(s => <span key={s} className="badge" style={{ background: G.bg2, color: G.text, border: `1px solid ${G.border}`, cursor: 'pointer' }} onClick={() => removeSkill(s)}>{s} ✕</span>)}
          {userSkills.length > 4 && <span className="badge" style={{ background: G.bg2, color: G.text2, border: `1px solid ${G.border}` }}>+{userSkills.length - 4} more</span>}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${G.border2}`, borderTopColor: G.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, marginBottom: 16 }}>
            {/* Score circle */}
            <div className="card card-lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 16 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke={G.bg2} strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor} strokeWidth="10"
                    strokeDasharray={`${score * 3.14159} 314.159`}
                    strokeDashoffset="78.5" strokeLinecap="round"
                    transform="rotate(-90 60 60)" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 30, color: scoreColor, lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: 11, color: G.text3, fontWeight: 500 }}>/ 100</div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 4 }}>Match Score</div>
              <div style={{ fontSize: 11, color: G.text2, marginBottom: 14 }}>{selectedRole}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                <div style={{ padding: 8, borderRadius: 6, background: G.greenBg, border: `1px solid ${G.greenBd}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: G.green }}>{matched.length}</div>
                  <div style={{ fontSize: 10, color: G.green }}>Matched</div>
                </div>
                <div style={{ padding: 8, borderRadius: 6, background: G.redBg, border: `1px solid ${G.redBd}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: G.red }}>{missing.length}</div>
                  <div style={{ fontSize: 10, color: G.red }}>Missing</div>
                </div>
              </div>
            </div>

            {/* Skill grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card" style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Required Skills — {selectedRole}</span>
                  <span style={{ fontSize: 11, color: G.text2 }}>{required.length} total</span>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {required.map(s => {
                    const has = matched.map(m => m.toLowerCase()).includes(s.toLowerCase());
                    return (
                      <span key={s} className="badge" style={{ background: has ? G.greenBg : G.redBg, color: has ? G.green : G.red, border: `1px solid ${has ? G.greenBd : G.redBd}`, fontSize: 12 }}>
                        {has ? '✓' : '✗'} {s}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Add skill */}
              <div className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: G.text, marginBottom: 10 }}>Add a skill to your profile</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={newSkill} onChange={e => setNewSkill(e.target.value)} placeholder="e.g. React, Docker…" onKeyDown={e => e.key === 'Enter' && addSkill()} />
                  <button className="btn btn-primary" onClick={addSkill}><Ic path={ICONS.plus} size={12} /> Add</button>
                </div>
              </div>
            </div>
          </div>

          {/* Learning priorities table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${G.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Learning Priorities</div>
              <div style={{ fontSize: 11, color: G.text2, marginTop: 2 }}>Ordered by impact and interview frequency</div>
            </div>
            <table className="table">
              <thead>
                <tr><th>#</th><th>Skill</th><th>Urgency</th><th>Est. Time</th><th>Why Learn</th><th>Resources</th></tr>
              </thead>
              <tbody>
                {prioritized.map((p, i) => (
                  <tr key={i}>
                    <td><span className="mono" style={{ color: G.text3, fontSize: 12 }}>0{i + 1}</span></td>
                    <td><span style={{ fontWeight: 600, color: G.text }}>{p.skill}</span></td>
                    <td><span className="badge" style={{ background: urgencyBg[p.urgency], color: urgencyColor[p.urgency], border: `1px solid ${urgencyBd[p.urgency]}` }}>{p.urgency}</span></td>
                    <td><span className="mono" style={{ fontSize: 12 }}>{p.time}</span></td>
                    <td style={{ color: G.text2, maxWidth: 200 }}>{p.why}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {['Docs', 'Course', 'YouTube'].map(r => (
                          <span key={r} className="badge" style={{ background: G.bg, color: G.text2, border: `1px solid ${G.border}`, cursor: 'pointer', fontSize: 10 }}>{r}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}