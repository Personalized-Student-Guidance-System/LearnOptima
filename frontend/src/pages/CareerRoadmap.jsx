import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const phaseColors = [G.green, G.blue, G.amber, G.purple];

export default function CareerRoadmap() {
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [data, setData] = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/profile');
      console.log('User Profile loaded:', res.data);
      setUserProfile(res.data);
      if (res.data?.targetRole) {
        console.log('Target role found:', res.data.targetRole);
        setRole(res.data.targetRole);
      } else {
        console.log('No target role set yet');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch roadmap when role changes
  useEffect(() => {
    if (role) {
      fetchRoadmap();
    }
  }, [role]);

  const fetchRoadmap = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/career/personalized?role=${encodeURIComponent(role)}`);
      console.log('Roadmap API Response:', res.data);
      console.log('Roadmap structure:', res.data.roadmap?.semesters?.length, 'semesters');
      setData(res.data);
      // Load saved checklist state
      if (res.data.checklistId) {
        const checklistRes = await axios.get(`/career/checklist/${res.data.checklistId}`);
        console.log('Checklist items:', checklistRes.data.items);
        setChecked(checklistRes.data.items || {});
      }
    } catch (err) {
      console.error('Failed to fetch roadmap:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (phase, item) => {
    const key = `${phase}-${item}`;
    const newChecked = { ...checked, [key]: !checked[key] };
    setChecked(newChecked);
    // Save to backend
    saveChecklistItem(key, newChecked[key]);
  };

  const saveChecklistItem = async (itemKey, isChecked) => {
    setSaving(prev => ({ ...prev, [itemKey]: true }));
    try {
      await axios.post('/career/checklist/item', {
        role,
        itemKey,
        isChecked,
      });
    } catch (err) {
      console.error('Failed to save checklist:', err);
    } finally {
      setSaving(prev => ({ ...prev, [itemKey]: false }));
    }
  };

  const selectRole = (selectedRole) => {
    setRole(selectedRole);
    // Optionally save to profile
    saveTargetRole(selectedRole);
  };

  const saveTargetRole = async (selectedRole) => {
    try {
      console.log(`[CareerRoadmap] Saving target role: ${selectedRole}`);
      const res = await axios.put('/profile', {
        targetRole: selectedRole,
      });
      console.log(`[CareerRoadmap] Target role saved successfully. Profile:`, res.data);
    } catch (err) {
      console.error('Failed to save target role:', err.response?.data || err.message);
    }
  };

  const phases    = data?.roadmap?.semesters || [];
  const allItems  = phases.flatMap(p => p.tasks || []);
  const doneCount = Object.values(checked).filter(Boolean).length;
  const pct       = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;
  const roles     = data?.availableRoles && data.availableRoles.length > 0 
    ? data.availableRoles 
    : ['Software Engineer', 'Data Scientist', 'DevOps Engineer', 'ML Engineer', 'Product Manager', 'Frontend Developer', 'Backend Developer'];
  
  // Debug logging
  useEffect(() => {
    if (data) {
      console.log('CareerRoadmap data received:', {
        role,
        semestersCount: phases.length,
        availableRoles: data.availableRoles,
        rolesDisplayed: roles,
        firstSemesterTasks: phases[0]?.tasks,
        firstTaskResources: phases[0]?.resources?.[0]
      });
    }
  }, [data, role, phases, roles]);

  if (loading) {
    return (
      <div style={{ padding: '24px 28px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, border: `2px solid ${G.border2}`, borderTopColor: G.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 12, color: G.text2 }}>Loading your profile...</span>
        </div>
      </div>
    );
  }

  // If no target role is set, show role selection prompt
  if (!role) {
    return (
      <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 900 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>Build Your Career Roadmap</h1>
          <p style={{ fontSize: 14, color: G.text2, marginTop: 2 }}>Select your target role to get a personalized career path with recommended skills, learning resources, and practice opportunities.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {roles.map((r) => (
            <div
              key={r}
              onClick={() => selectRole(r)}
              className="card"
              style={{
                padding: '24px',
                cursor: 'pointer',
                border: `2px solid ${G.border}`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = G.blue;
                e.currentTarget.style.background = G.bg2;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = G.border;
                e.currentTarget.style.background = G.white;
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: G.text, marginBottom: 8 }}>
                {r}
              </div>
              <div style={{ fontSize: 12, color: G.text2, lineHeight: 1.5 }}>
                I want to become a {r.toLowerCase()}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Career Roadmap</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Your personalized path to become a {role}</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setRole(null)}
          style={{ marginTop: 2 }}
        >
          Change Role
        </button>
      </div>

      {/* Role selection cards - show related roles */}
      <div className="card card-md" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: G.text3, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Switch roles
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 0, flexWrap: 'wrap' }}>
          {(roles || []).map(r => (
            <button
              key={r}
              onClick={() => selectRole(r)}
              className="btn btn-sm"
              style={{
                background: r === role ? G.blue : G.white,
                color: r === role ? G.white : G.text,
                border: `2px solid ${r === role ? G.blue : G.border}`,
                fontWeight: r === role ? 700 : 500
              }}
            >
              {r === role ? '✓ ' : ''}{r}
            </button>
          ))}
        </div>
      </div>

      {/* Progress and overview */}
      <div className="card card-md" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: G.text2 }}>Overall Progress</span>
              <span className="mono" style={{ fontSize: 12, color: G.text }}>{doneCount}/{allItems.length} completed</span>
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
      ) : phases.length === 0 ? (
        <div style={{ padding: 24 }}>
          <div style={{ padding: 60, textAlign: 'center', background: G.bg2, borderRadius: 8, border: `1px solid ${G.border}`, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text2, marginBottom: 8 }}>No roadmap data available</div>
            <div style={{ fontSize: 12, color: G.text3, marginBottom: 16 }}>The roadmap for {role} could not be loaded. Try refreshing the page or selecting a different role.</div>
            <button className="btn btn-primary btn-sm" onClick={() => fetchRoadmap()}>Reload Roadmap</button>
          </div>
          
          {/* Debug info */}
          <div className="card card-sm" style={{ background: G.bg2, padding: 12, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 8 }}>DEBUG INFO</div>
            <div style={{ fontSize: 10, color: G.text3, whiteSpace: 'pre-wrap', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.4 }}>
{`Selected Role: ${role || 'None'}
Data Loaded: ${data ? 'Yes' : 'No'}
Roadmap Semesters: ${phases.length}
Available Roles: ${data?.availableRoles?.join(', ') || 'Not loaded yet'}
Checkpoints: ${userProfile ? 'Profile loaded' : 'Profile loading...'}`}
            </div>
          </div>
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

                  <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(phase.tasks || []).map((item, taskIdx) => {
                      const key  = `${phaseKey}-${item}`;
                      const done = !!checked[key];
                      const resourceData = phase.resources?.[taskIdx] || {};
                      const resources = resourceData.resources || [];
                      const hasSkill = resourceData.hasSkill || false;
                      
                      return (
                        <div key={item} style={{ borderRadius: 5, border: `1px solid ${done ? G.greenBd : G.border}`, background: done ? G.greenBg : G.bg, overflow: 'hidden' }}>
                          <div
                            onClick={() => toggle(phaseKey, item)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                              <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${done ? G.green : G.border2}`, background: done ? G.green : G.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {done && <Ic path={ICONS.check} size={8} color={G.white} sw={2.5} />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: done ? G.green : G.text, textDecoration: done ? 'line-through' : 'none' }}>{item}</span>
                                {hasSkill && <span style={{ fontSize: 10, color: G.green, marginLeft: 8, fontWeight: 600 }}>✓ You have this</span>}
                              </div>
                            </div>
                            
                            {resources.length > 0 && (
                              <span style={{ fontSize: 10, color: G.text3, padding: '2px 6px', background: G.border2 + '40', borderRadius: 3 }}>
                                {resources.length} resources
                              </span>
                            )}
                          </div>
                          
                          {/* Resources - Compact */}
                          {resources.length > 0 && (
                            <div style={{ padding: '6px 12px', borderTop: `1px solid ${G.border}`, background: G.bg2 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {resources.map((resource, idx) => (
                                  <a
                                    key={idx}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      fontSize: 11,
                                      color: G.blue,
                                      textDecoration: 'none',
                                      padding: '4px 6px',
                                      borderRadius: 3,
                                      background: G.blueBg,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = G.blue + '20';
                                      e.currentTarget.style.textDecoration = 'underline';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = G.blueBg;
                                      e.currentTarget.style.textDecoration = 'none';
                                    }}
                                    title={resource.title}
                                  >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{resource.title}</span>
                                    <Ic path={ICONS.externalLink} size={8} color={G.blue} sw={2} style={{ flexShrink: 0 }} />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
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