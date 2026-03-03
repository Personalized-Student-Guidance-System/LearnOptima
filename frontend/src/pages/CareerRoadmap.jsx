import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Ic } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const phaseColors = [G.green, G.blue, G.amber, G.purple];

export default function CareerRoadmap() {
  const [role,    setRole]    = useState('Software Engineer');
  const [data,    setData]    = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchRoadmap(); }, [role]);

  const fetchRoadmap = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/career?role=${encodeURIComponent(role)}`);
      setData(res.data);
    } catch {} finally { setLoading(false); }
  };

  const toggle = (phase, item) => {
    const key = `${phase}-${item}`;
    setChecked(p => ({ ...p, [key]: !p[key] }));
  };

  const phases    = data?.roadmap?.semesters || [];
  const allItems  = phases.flatMap(p => p.tasks || []);
  const doneCount = Object.values(checked).filter(Boolean).length;
  const pct       = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;
  const roles     = data?.availableRoles || ['Software Engineer', 'Data Scientist'];

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Career Roadmap</h1>
        <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Semester-by-semester roadmap to your target role</p>
      </div>

      {/* Role + progress */}
      <div className="card card-md" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {roles.map(r => (
            <button key={r} onClick={() => setRole(r)} className="btn btn-sm" style={{ background: r === role ? G.text : G.white, color: r === role ? G.white : G.text, border: `1px solid ${r === role ? G.text : G.border}` }}>{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: G.text2 }}>Overall progress</span>
              <span className="mono" style={{ fontSize: 12, color: G.text }}>{doneCount}/{allItems.length} topics</span>
            </div>
            <div className="progress-track" style={{ height: 6 }}>
              <div className="progress-bar" style={{ width: `${pct}%`, background: G.green }} />
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: G.green }}>{pct}%</div>
            <div style={{ fontSize: 11, color: G.text3 }}>complete</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${G.border2}`, borderTopColor: G.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 18, top: 28, bottom: 28, width: 1, background: G.border }} />
          {phases.map((phase, pi) => {
            const phaseDone  = (phase.tasks || []).filter(item => checked[`${phase.title || phase.phase || pi}-${item}`]).length;
            const phaseColor = phaseColors[pi % phaseColors.length];
            const isComplete = phaseDone === (phase.tasks || []).length && phase.tasks?.length > 0;
            const phaseKey   = phase.title || phase.phase || `phase-${pi}`;

            return (
              <div key={pi} style={{ position: 'relative', paddingLeft: 52, marginBottom: 16 }}>
                <div style={{ position: 'absolute', left: 8, top: 18, width: 20, height: 20, borderRadius: '50%', background: isComplete ? G.green : pi === 0 ? phaseColor : G.white, border: `2px solid ${isComplete ? G.green : phaseColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                  {isComplete ? <Ic path={ICONS.check} size={9} color={G.white} sw={3} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: phaseColor }} />}
                </div>

                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Sem {phase.sem} · {phase.duration || '12 months'}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>{phase.title || phaseKey}</div>
                      </div>
                      <span className="badge" style={{ background: phaseColor + '12', color: phaseColor, border: `1px solid ${phaseColor}30` }}>
                        {phaseDone}/{(phase.tasks || []).length}
                      </span>
                    </div>
                    <div style={{ width: 60 }}>
                      <div className="progress-track" style={{ height: 3 }}>
                        <div className="progress-bar" style={{ width: `${phase.tasks?.length ? (phaseDone / phase.tasks.length) * 100 : 0}%`, background: phaseColor }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 6 }}>
                    {(phase.tasks || []).map(item => {
                      const key  = `${phaseKey}-${item}`;
                      const done = !!checked[key];
                      return (
                        <div key={item} onClick={() => toggle(phaseKey, item)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, background: done ? G.greenBg : G.bg, border: `1px solid ${done ? G.greenBd : G.border}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${done ? G.green : G.border2}`, background: done ? G.green : G.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {done && <Ic path={ICONS.check} size={8} color={G.white} sw={2.5} />}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: done ? G.green : G.text, textDecoration: done ? 'line-through' : 'none' }}>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}