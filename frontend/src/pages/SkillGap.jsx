import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Ic } from '../design/ui';
import { G, ICONS } from '../design/tokens';
import * as API from '../services/api';

const urgencyColor = { Critical: G.red, High: G.amber, Medium: G.blue };
const urgencyBg = { Critical: G.redBg, High: G.amberBg, Medium: G.blueBg };
const urgencyBd = { Critical: G.redBd, High: G.amberBd, Medium: G.blueBd };

export default function SkillGap() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [aiRec, setAiRec] = useState(null);
  const [learningPath, setLearningPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedGaps, setExpandedGaps] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [customRoleInput, setCustomRoleInput] = useState('');

  // Initialize and sync selectedRole with user's targetRole
  useEffect(() => {
    // Use user's targetRole if available, otherwise default to Software Engineer
    const roleToUse = user?.targetRole || 'Software Engineer';
    setSelectedRole(roleToUse);
    console.log('[SkillGap] Initialized/synced role to:', roleToUse);
  }, [user?.targetRole, user]);

  useEffect(() => {
    if (selectedRole) {
      loadAnalysis(selectedRole);
    }
  }, [selectedRole]);

  const loadAnalysis = async (role) => {
    console.log('[SkillGap] Loading analysis for role:', role);
    setLoading(true);
    try {
      const [analysisRes, aiRes, pathRes] = await Promise.all([
        API.analyzeSkillGap(role),
        API.getSkillAIRecommendation(role),
        API.getSkillLearningPath(role)
      ]);
      console.log('[SkillGap] Analysis loaded, data role:', analysisRes.data.role);
      setData(analysisRes.data);
      setAiRec(aiRes.data);
      setLearningPath(pathRes.data);
    } catch (err) {
      console.error('Error loading analysis:', err.response?.data || err.message);
      if (err?.response?.status === 401) {
        console.error('Auth error - token may be invalid');
      }
    } finally {
      setLoading(false);
    }
  };

  const addSkillToLearn = async (skill) => {
    try {
      const res = await API.updateSkillLearningQueue(skill, 'add');
      setData(prev => ({
        ...prev,
        learning_queue: res.data.skillsToLearn
      }));
    } catch (err) {
      console.error('Error adding skill:', err.response?.data || err.message);
    }
  };

  const removeSkillToLearn = async (skill) => {
    try {
      const res = await API.updateSkillLearningQueue(skill, 'remove');
      setData(prev => ({
        ...prev,
        learning_queue: res.data.skillsToLearn
      }));
    } catch (err) {
      console.error('Error removing skill:', err.response?.data || err.message);
    }
  };

  const addNewSkill = async () => {
    if (!newSkill.trim()) return;
    await addSkillToLearn(newSkill.trim());
    setNewSkill('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${G.border2}`, borderTopColor: G.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 24, color: G.text2 }}>Unable to load skill analysis. Please try again.</div>;
  }

  const overview = data?.overview || {};
  const matched = data?.matched_skills || [];
  const missing = data?.missing_skills || [];
  const topPriorities = data?.top_5_priorities || [];
  const learningQueue = data?.learning_queue || [];
  const score = overview.match_score || 0;
  const scoreColor = score >= 80 ? G.green : score >= 60 ? G.amber : score >= 40 ? G.blue : G.red;

  // Learning Priorities: order by impact and interview frequency
  const learningPriorities = topPriorities
    .sort((a, b) => {
      const impactA = a.priority_score || 0;
      const impactB = b.priority_score || 0;
      const interviewFreqA = a.interview_frequency || 0;
      const interviewFreqB = b.interview_frequency || 0;
      // Sort by interview frequency (desc) then impact (desc)
      return interviewFreqB - interviewFreqA || impactB - impactA;
    })
    .slice(0, 8);

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1200 }}>
      {/* Header with Role Selector */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Skill Gap Analyzer</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 4 }}>
            {data?.userSkillsCount} skills documented • Analyze gaps and create your learning roadmap
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 280 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: G.text, whiteSpace: 'nowrap' }}>Target Role:</label>
          <div style={{ display: 'flex', gap: 8, width: 280 }}>
            <input 
              type="text"
              value={customRoleInput || selectedRole}
              onChange={(e) => setCustomRoleInput(e.target.value)}
              placeholder="e.g. Quantum Engineer"
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && customRoleInput.trim()) {
                    setSelectedRole(customRoleInput.trim());
                 }
              }}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: `1px solid ${G.border}`,
                background: G.bg,
                color: G.text,
                fontWeight: 500,
                outline: 'none'
              }}
            />
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => {
                 if (customRoleInput.trim()) {
                    setSelectedRole(customRoleInput.trim());
                 }
              }}
            >
              Analyze
            </button>
          </div>
        </div>
      </div>

      {/* Brief Analysis Card */}
      <div className="card" style={{ marginBottom: 20, padding: '18px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 20, alignItems: 'center' }}>
          {/* Score Circle */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 10px' }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke={G.bg2} strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="8"
                  strokeDasharray={`${score * 2.64} 264`}
                  strokeDashoffset="66" strokeLinecap="round"
                  transform="rotate(-90 50 50)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 28, color: scoreColor }}>{score}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: G.text2 }}>Match Score</div>
          </div>

          {/* Analysis Text */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.green }}>{overview.matched_count}</div>
                <div style={{ fontSize: 11, color: G.text2, marginTop: 2 }}>Skills Matched</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.red }}>{overview.missing_count}</div>
                <div style={{ fontSize: 11, color: G.text2, marginTop: 2 }}>Skills to Learn</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: G.text, lineHeight: 1.5, margin: 0 }}>
              {overview.analysis}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Toggle */}
      <div 
        className="card" 
        onClick={() => setExpandedGaps(!expandedGaps)}
        style={{ marginBottom: 20, padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onMouseOver={e => e.currentTarget.style.background = G.bg}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Detailed Gap Breakdown</span>
        <Ic path={ICONS[expandedGaps ? 'chevDown' : 'chevRight']} size={14} color={G.text2} />
      </div>

      {expandedGaps && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Matched Skills */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 12, fontWeight: 700 }}>
              ✓ Your Strengths ({matched.length})
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {matched.slice(0, 10).map(s => (
                <span key={s.skill} className="badge" style={{ background: G.greenBg, color: G.green, border: `1px solid ${G.greenBd}`, fontSize: 11 }}>
                  {s.skill}
                </span>
              ))}
              {matched.length > 10 && (
                <span className="badge" style={{ background: G.bg2, color: G.text2, border: `1px solid ${G.border}`, fontSize: 11 }}>
                  +{matched.length - 10} more
                </span>
              )}
            </div>
          </div>

          {/* Missing Skills */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 12, fontWeight: 700 }}>
              ✗ Areas to Focus ({missing.length})
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {missing.slice(0, 10).map(s => (
                <span key={s.skill} className="badge" 
                  style={{ 
                    background: urgencyBg[s.urgency] || G.redBg, 
                    color: urgencyColor[s.urgency] || G.red, 
                    border: `1px solid ${urgencyBd[s.urgency] || G.redBd}`,
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                  onClick={() => addSkillToLearn(s.skill)}
                  title="Click to add to learning queue"
                >
                  {s.skill} +
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skills to Learn Queue */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}` }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px 0' }}>My Learning Queue</h3>
          <p style={{ fontSize: 11, color: G.text2, margin: 0 }}>Skills you want to prioritize</p>
        </div>
        <div style={{ padding: '14px 16px' }}>
          {learningQueue.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {learningQueue.map(s => (
                <span key={s} className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`, fontSize: 11, cursor: 'pointer' }}>
                  {s} <span onClick={() => removeSkillToLearn(s)} style={{ marginLeft: 4, cursor: 'pointer' }}>✕</span>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: G.text2, margin: '0 0 12px 0' }}>No skills in queue yet. Click on missing skills above to add them.</p>
          )}
          
          {/* Add skill input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              className="input" 
              placeholder="Add a skill you want to learn..." 
              value={newSkill} 
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewSkill()}
              style={{ fontSize: 12 }}
            />
            <button className="btn btn-primary btn-sm" onClick={addNewSkill}>Add</button>
          </div>
        </div>
      </div>

      {/* Learning Priorities */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.amber}08` }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: G.amber }}>⭐ Learning Priorities</h3>
          <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0 0' }}>Ordered by impact and interview frequency</p>
        </div>
        <div style={{ padding: '16px' }}>
          {learningPriorities.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {learningPriorities.map((skill, i) => (
                <div key={i} style={{ 
                  padding: '14px', 
                  borderRadius: 8, 
                  border: `1px solid ${G.border}`,
                  background: G.bg,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  ':hover': { background: G.bg2 }
                }}
                onMouseOver={e => e.currentTarget.style.background = G.bg2}
                onMouseOut={e => e.currentTarget.style.background = G.bg}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>#{i + 1}</div>
                    <span className="badge" style={{ background: urgencyBg[skill.urgency], color: urgencyColor[skill.urgency], border: `1px solid ${urgencyBd[skill.urgency]}`, fontSize: 10 }}>
                      {skill.urgency}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: G.text, marginBottom: 8 }}>{skill.skill}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, fontSize: 11, color: G.text2 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: G.text }}>Impact</div>
                      <div>{skill.priority_score || 85}%</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: G.text }}>Interview</div>
                      <div>{skill.interview_frequency || 'High'}%</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: G.text2, paddingTop: 8, borderTop: `1px solid ${G.border}` }}>
                    ⏱️ {Math.ceil((skill.time_to_proficiency_days || 30) / 7)} weeks to master
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: G.text2, margin: 0 }}>No priority skills to display.</p>
          )}
        </div>
      </div>

      {/* Top Priorities Table */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}` }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Top Priority Skills</h3>
          <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0 0' }}>Ranked by importance to {data.role}</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: G.text2 }}>Skill</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: G.text2 }}>Urgency</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: G.text2 }}>Time (weeks)</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: G.text2 }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {topPriorities.map((skill, i) => (
                <tr key={i} style={{ borderBottom: i < topPriorities.length - 1 ? `1px solid ${G.border}` : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 500 }}>
                    {i + 1}. {skill.skill}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span className="badge" style={{ background: urgencyBg[skill.urgency], color: urgencyColor[skill.urgency], border: `1px solid ${urgencyBd[skill.urgency]}`, fontSize: 10 }}>
                      {skill.urgency}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: G.text2 }}>
                    {Math.ceil((skill.time_to_proficiency_days || 30) / 7)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 12, background: scoreColor, opacity: 0.1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor }}>{skill.priority_score || 85}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Recommendations */}
      {aiRec && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.blue}08` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: G.blue }}>🤖 AI-Powered Insights</h3>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Analysis */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 6 }}>Your Journey</h4>
                <p style={{ fontSize: 12, color: G.text2, lineHeight: 1.5, margin: 0 }}>
                  {aiRec.analysis}
                </p>
              </div>

              {/* Timeline */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 6 }}>Learning Timeline</h4>
                <p style={{ fontSize: 12, color: G.text2, marginBottom: 8 }}>
                  Estimated time to master core skills:
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: G.blue }}>
                    {aiRec.estimated_time_to_ready_weeks}
                  </div>
                  <div style={{ fontSize: 11, color: G.text2 }}>weeks</div>
                </div>
              </div>
            </div>

            {/* Action Plan */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${G.border}` }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 10 }}>Recommended Action Plan</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {aiRec.action_plan?.map((phase, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 6, background: G.bg2, border: `1px solid ${G.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: G.blue, marginBottom: 4 }}>{phase.week}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: G.text, marginBottom: 3 }}>{phase.focus}</div>
                    <div style={{ fontSize: 10, color: G.text2 }}>{phase.action}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Steps */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${G.border}` }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 8 }}>Next Steps</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aiRec.next_steps?.map((step, i) => (
                  <div key={i} style={{ fontSize: 12, color: G.text2, display: 'flex', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: G.blue }}>{step.charAt(0)}</span>
                    <span>{step.slice(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learning Path Timeline */}
      {learningPath && (
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${G.border}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Learning Path Timeline</h3>
            <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0 0' }}>Estimated {learningPath.total_duration_weeks} weeks to complete</p>
          </div>
          <div style={{ padding: '16px' }}>
            {learningPath.learning_path?.map((phase, i) => (
              <div key={i} style={{ marginBottom: i < learningPath.learning_path.length - 1 ? 16 : 0, paddingBottom: i < learningPath.learning_path.length - 1 ? 16 : 0, borderBottom: i < learningPath.learning_path.length - 1 ? `1px solid ${G.border}` : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: 12, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: G.blue }}>{i + 1}</div>
                    <div style={{ fontSize: 10, color: G.text2, marginTop: 2 }}>Week {phase.start_week}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 4 }}>{phase.skill}</div>
                    <div style={{ fontSize: 11, color: G.text2 }}>Focus: Master the fundamentals and build projects</div>
                  </div>
                  <div style={{ textAlign: 'right', padding: '6px 10px', borderRadius: 6, background: urgencyBg[phase.urgency], color: urgencyColor[phase.urgency], border: `1px solid ${urgencyBd[phase.urgency]}`, fontSize: 10, fontWeight: 600 }}>
                    {phase.urgency}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}