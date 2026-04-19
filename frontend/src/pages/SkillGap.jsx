import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Ic } from '../design/ui';
import { G, ICONS } from '../design/tokens';
import * as API from '../services/api';

const urgencyColor = { Critical: G.red, High: G.amber, Medium: G.blue };
const urgencyBg = { Critical: G.redBg, High: G.amberBg, Medium: G.blueBg };
const urgencyBd = { Critical: G.redBd, High: G.amberBd, Medium: G.blueBd };

// ─── Sub-components ────────────────────────────────────────────────────────────

function UrgencyDot({ urgency }) {
  const colors = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6' };
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: colors[urgency] || colors.Medium, flexShrink: 0,
      boxShadow: `0 0 0 2px ${(urgencyBg[urgency] || G.blueBg)}`,
    }} />
  );
}

function UrgencyBadge({ urgency }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
      background: urgencyBg[urgency] || G.blueBg,
      color: urgencyColor[urgency] || G.blue,
      border: `1px solid ${urgencyBd[urgency] || G.blueBd}`,
    }}>
      <UrgencyDot urgency={urgency} />
      {urgency}
    </span>
  );
}

function MiniBar({ value, color }) {
  return (
    <div style={{ height: 4, borderRadius: 2, background: G.bg2, overflow: 'hidden', flex: 1 }}>
      <div style={{
        height: '100%', width: `${Math.min(100, value)}%`,
        background: color, borderRadius: 2,
        transition: 'width 0.7s ease',
      }} />
    </div>
  );
}

function ScoreArc({ score, color, size = 120 }) {
  const r = size / 2 - 11;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={G.bg2} strokeWidth={9} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={9}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s ease' }}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 32, fontWeight: 900, fill: color, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }}>{score}</text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', fill: G.text2 }}>MATCH</text>
    </svg>
  );
}

function StatPill({ label, val, color, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 90, padding: '16px 12px', borderRadius: 14,
      background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.8)', textAlign: 'center',
      boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
      transition: 'transform 0.2s ease',
    }} className="sg-chip">
      <div style={{ fontSize: 26, fontWeight: 900, color: color || G.text, lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>{val}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginTop: 8, letterSpacing: '0.02em' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: G.text2, marginTop: 2, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

// ─── Scraping Loading Screen ───────────────────────────────────────────────────
function ScrapingLoader({ role }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: '🔍', text: `Analyzing current job listings for "${role}"…` },
    { icon: '⚡', text: `Comparing your skills against industry requirements…` },
    { icon: '📈', text: `Identifying high-impact learning opportunities…` },
    { icon: '✨', text: `Building your personalized skill matrix…` }
  ];
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '52vh', gap: 24,
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeStep{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          border: `4px solid ${G.border2}`,
          borderTopColor: G.blue,
          borderLeftColor: G.blue,
          animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
          position: 'absolute',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>{steps[step].icon}</div>
      </div>

      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: G.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
          Generating Analysis
        </div>
        <div
          key={step}
          style={{
            fontSize: 14, color: G.text2, animation: 'fadeStep 0.4s ease',
            lineHeight: 1.5, minHeight: 40,
          }}
        >
          {steps[step].text}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: i === step ? G.blue : G.border2,
            transition: 'all 0.3s',
            transform: i === step ? 'scale(1.3)' : 'scale(1)',
          }} />
        ))}
      </div>

      <div style={{ fontSize: 11, color: G.text3, textAlign: 'center', maxWidth: 280 }}>
        This real-time market analysis safely takes a few seconds.<br />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SkillGap() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [aiRec, setAiRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedGaps, setExpandedGaps] = useState(true);
  const [newSkill, setNewSkill] = useState('');
  const [activeTab, setActiveTab] = useState('priorities');
  const [selectedRole, setSelectedRole] = useState(user?.targetRole || 'Software Engineer');
  const [toastMsg, setToastMsg] = useState('');
  
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };
  
  const [allRoles, setAllRoles] = useState(
    user?.targetRoles?.length ? user.targetRoles : [user?.targetRole || 'Software Engineer']
  );

  useEffect(() => {
    const initRoles = async () => {
      try {
        const profileRes = await API.getStudentProfile();
        const profile = profileRes.data;
        const roles = profile.targetRoles?.length
          ? profile.targetRoles
          : [profile.targetRole || 'Software Engineer'];
        setAllRoles(roles);

        if (!roles.includes(selectedRole)) {
          setSelectedRole(profile.targetRole || roles[0]);
        }
      } catch (e) {
        // ignore
      }
    };
    initRoles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadAnalysis(selectedRole);
    }
  }, [selectedRole]);

  const loadAnalysis = async (role, refresh = false) => {
    setLoading(true);
    setError(null);
    setData(null);
    setAiRec(null);
    try {
      const [analysisRes, aiRes] = await Promise.all([
        API.analyzeSkillGap(role, refresh),
        API.getSkillAIRecommendation(role),
      ]);
      setData(analysisRes.data);
      setAiRec(aiRes.data);
    } catch (err) {
      const msg = err.response?.data?.details || err.response?.data?.message || err.message;
      setError(msg);
      console.error('[SkillGap] Error:', msg);
    } finally {
      setLoading(false);
    }
  };

  const addToQueue = async (skill) => {
    try {
      const res = await API.updateSkillLearningQueue(skill, 'add');
      setData(prev => ({ ...prev, learning_queue: res.data.skillsToLearn }));
      showToast(`Added "${skill}" to learning queue`);
    } catch (err) { console.error(err); }
  };

  const removeFromQueue = async (skill) => {
    try {
      const res = await API.updateSkillLearningQueue(skill, 'remove');
      setData(prev => ({ ...prev, learning_queue: res.data.skillsToLearn }));
      showToast(`Removed "${skill}" from queue`);
    } catch (err) { console.error(err); }
  };

  const markCompleted = async (skill) => {
    try {
      const res = await API.updateSkillLearningQueue(skill, 'complete');
      setData(prev => ({ ...prev, learning_queue: res.data.skillsToLearn }));
      showToast(`"${skill}" marked complete & added to Profile!`);
      loadAnalysis(selectedRole, true);
    } catch (err) { console.error(err); }
  };

  const addCustomSkill = async () => {
    if (!newSkill.trim()) return;
    await addToQueue(newSkill.trim());
    setNewSkill('');
  };

  // ─── States ─────────────────────────────────────────────────────────────────
  if (loading) return <ScrapingLoader role={selectedRole} />;

  if (error) return (
    <div style={{ padding: 24 }}>
      <div style={{
        padding: '20px 24px', borderRadius: 10, border: `1px solid ${G.redBd}`,
        background: G.redBg, maxWidth: 560,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: G.red, marginBottom: 6 }}>
          ⚠️ ML Scraper Error
        </div>
        <p style={{ fontSize: 12, color: G.text2, margin: '0 0 14px' }}>{error}</p>
        <div style={{ fontSize: 11, color: G.text3, marginBottom: 14 }}>
          Make sure Python dependencies (beautifulsoup4, scikit-learn) are installed.
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => loadAnalysis(selectedRole)}>
          Retry
        </button>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ padding: 24, color: G.text2 }}>
      No data returned. <button className="btn btn-secondary btn-sm" onClick={() => loadAnalysis(selectedRole)}>Retry</button>
    </div>
  );

  const overview = data.overview || {};
  const matched = data.matched_skills || [];
  const missing = data.missing_skills || [];
  const topPriorities = data.top_5_priorities || [];
  const learningQueue = data.learning_queue || [];
  const score = overview.match_score || 0;
  const scoreColor = score >= 80 ? G.green : score >= 60 ? G.amber : score >= 40 ? G.blue : G.red;
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Developing' : 'Beginner';

  const sortedPriorities = [...topPriorities].sort((a, b) => {
    const o = { Critical: 0, High: 1, Medium: 2 };
    return (o[a.urgency] ?? 2) - (o[b.urgency] ?? 2);
  });

  const TABS = [
    { id: 'priorities', label: '⭐ Priorities' },
    { id: 'ai', label: '🤖 AI Action Plan' },
  ];

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1200 }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes toastIn{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes toastOut{from{opacity:1}to{opacity:0;transform:translateY(10px)}}
        .sg-in{animation:fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both}
        .sg-chip{transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);cursor:pointer}
        .sg-chip:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 8px 20px rgba(0,0,0,0.08)}
        .sg-chip:active{transform:scale(0.96)}
        .sg-row:hover{background:${G.bg}!important}
        .wow-banner {
          background: linear-gradient(-45deg, #eff4ff, #e0e7ff, #f3e8ff, #fce7f3);
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
          border: 1px solid rgba(255,255,255,0.4);
          position: relative;
          overflow: hidden;
        }
        .wow-banner::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(circle at top right, rgba(255,255,255,0.7) 0%, transparent 60%);
          pointer-events: none;
        }
      `}</style>

      {/* ── Toast Notification ─────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderRadius: 10,
          background: '#111827', color: '#fff',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          animation: 'toastIn 0.25s cubic-bezier(0.16,1,0.3,1) both',
          maxWidth: 320,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#22c55e', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, flexShrink: 0,
          }}>✓</span>
          {toastMsg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Skill Gap Analyzer
          </h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 4 }}>
            {data.userSkillsCount || 0} skills on record •{' '}
            <span style={{ color: G.text3 }}>Live job-market analysis via offline NLP & Scikit-Learn</span>
          </p>
        </div>

        {/* Role pill */}
        {/* Role pill — replace the existing one */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', borderRadius: 8,
          background: `${G.blue}10`, border: `1px solid ${G.blueBd}`,
        }}>
          <div>
            <div style={{
              fontSize: 9, color: G.text3, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Target Role</div>

            {/* NEW: dropdown instead of static text */}
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              style={{
                fontSize: 13, fontWeight: 700, color: G.blue,
                background: 'transparent', border: 'none',
                outline: 'none', cursor: 'pointer', marginTop: 1,
                padding: 0,
              }}
            >
              {allRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
              {/* Allow navigating to profile to add more roles */}
            </select>
          </div>

          <div style={{ width: 1, height: 26, background: G.blueBd }} />

          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 10, padding: '3px 8px' }}
            onClick={() => navigate('/profile')}
          >
            Edit roles →
          </button>

          <button
            title="Re-run live scraping"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 6, color: G.text3,
              fontSize: 14, lineHeight: 1,
            }}
            onClick={() => loadAnalysis(selectedRole, true)}
          >↺</button>
        </div>
      </div>

      {/* ── Score Banner ─────────────────────────────────────────────────── */}
      <div className="card sg-in wow-banner" style={{ marginBottom: 24, padding: '24px 28px', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {/* Arc */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <ScoreArc score={score} color={scoreColor} size={120} />
            <div style={{
              marginTop: 4, display: 'inline-block', padding: '2px 10px',
              borderRadius: 99, fontSize: 10, fontWeight: 700,
              background: urgencyBg[score >= 80 ? 'Medium' : score >= 60 ? 'High' : 'Critical'],
              color: scoreColor,
            }}>{scoreLabel}</div>
          </div>

          <div style={{ width: 1, height: 80, background: G.border, flexShrink: 0 }} />

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap', minWidth: 240 }}>
            <StatPill label="Matched" val={overview.matched_count || 0} color={G.green} sub={`of ${overview.total_required || 0} required`} />
            <StatPill label="To Learn" val={overview.missing_count || 0} color={G.red} sub="identified gaps" />
            <StatPill label="In Queue" val={learningQueue.length} color={G.blue} sub="skills queued" />
            <StatPill label="Ready In" val={`${aiRec?.estimated_time_to_ready_weeks || data.estimated_weeks || '?'}w`} color={G.purple} sub="estimated" />
          </div>

          <div style={{ width: 1, height: 80, background: G.border, flexShrink: 0 }} />

          {/* Analysis text */}
          <div style={{ flex: '0 0 240px', minWidth: 180 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: G.text, marginBottom: 6 }}>
              Live Market Analysis
              {data.source === 'ml-scraper' && (
                <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 99, background: G.greenBg, color: G.green, border: `1px solid ${G.greenBd}` }}>
                  LIVE
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: G.text2, lineHeight: 1.6, margin: 0 }}>
              {overview.analysis}
            </p>
            {overview.key_insight && (
              <p style={{ fontSize: 11, color: G.amber, margin: '8px 0 0', fontStyle: 'italic' }}>
                💡 {overview.key_insight}
              </p>
            )}
          </div>
        </div>

        {/* Overall match bar */}
        {/* Overall match bar */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid rgba(0,0,0,0.06)`, position: 'relative', zIndex: 1, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>
              Total Readiness for <span style={{ color: G.blue }}>{selectedRole}</span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 900, color: scoreColor }}>{score}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg, ${scoreColor}cc, ${scoreColor})`, borderRadius: 99, transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
          </div>
        </div>
      </div>

      {/* ── Skill Breakdown (collapsible) ────────────────────────────────── */}
      <div
        className="card sg-card"
        onClick={() => setExpandedGaps(!expandedGaps)}
        style={{
          marginBottom: 20, padding: '12px 16px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          border: `1px solid ${G.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Skill Breakdown</span>
          {matched.length > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: G.greenBg, color: G.green, border: `1px solid ${G.greenBd}` }}>
              ✓ {matched.length} matched
            </span>
          )}
          {missing.length > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: G.redBg, color: G.red, border: `1px solid ${G.redBd}` }}>
              ✗ {missing.length} missing
            </span>
          )}
        </div>
        <Ic path={ICONS[expandedGaps ? 'chevDown' : 'chevRight']} size={14} color={G.text2} />
      </div>

      {
        expandedGaps && (
          <div className="sg-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 20, marginBottom: 20 }}>
            {/* Student Skills */}
            <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${G.border}`, background: `${G.blueBg}` }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: G.blue, letterSpacing: '-0.02em' }}>
                  🧑‍💻 Your Active Portfolio
                </span>
                <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0' }}>Skills identified on your profile</p>
              </div>
              <div style={{ padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, alignContent: 'flex-start' }}>
                {matched.length === 0
                  ? <p style={{ fontSize: 12, color: G.text3, margin: 0 }}>You haven't logged any skills relevant to this role yet.</p>
                  : matched.map(s => (
                    <span key={s.skill} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: `${G.green}15`, color: G.green, border: `1px solid ${G.green}30`,
                    }}>
                      {s.skill}
                    </span>
                  ))
                }
              </div>
            </div>

            {/* Industry Requirements */}
            <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${G.border}`, background: `${G.purple}08` }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: G.purple, letterSpacing: '-0.02em' }}>
                  🏢 Industry Requirements
                </span>
                <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0' }}>Derived from live job postings & O*NET data</p>
              </div>
              <div style={{ padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, alignContent: 'flex-start' }}>
                {(data.required_skills || []).map(skillName => {
                  const isMatched = matched.some(m => m.skill.toLowerCase() === skillName.toLowerCase());
                  
                  return (
                    <span key={skillName}
                      onClick={() => !isMatched && addToQueue(skillName)}
                      title={!isMatched ? "Click to add to learning queue" : "Already matched"}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: isMatched ? `${G.green}15` : G.surface,
                        color: isMatched ? G.green : G.text,
                        border: `1px solid ${isMatched ? `${G.green}30` : G.border2}`,
                        cursor: isMatched ? 'default' : 'pointer',
                        boxShadow: isMatched ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                      }}>
                      {isMatched ? <span style={{ fontSize: 10 }}>✓</span> : <span style={{ color: G.red, fontSize: 10 }}>📌</span>}
                      {skillName}
                      {!isMatched && <span style={{ color: G.blue, fontSize: 14, fontWeight: 800, marginLeft: 2, marginRight: -2 }}>+</span>}
                    </span>
                  )
                })}
              </div>
              {missing.length > 0 && (
                <div style={{ padding: '0 18px 12px', fontSize: 10, color: G.text3, fontWeight: 600 }}>
                  * Non-checked skills represent your gaps. Click any to add to queue.
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* ── Learning Queue ───────────────────────────────────────────────── */}
      <div style={{
        marginBottom: 16, padding: '10px 14px', borderRadius: 10,
        background: G.surface, border: `1px solid ${G.border}`,
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Label + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>📚 Queue</span>
          {learningQueue.length > 0 && (
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 99,
              background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`,
              fontWeight: 700,
            }}>{learningQueue.length}</span>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: G.border, flexShrink: 0 }} />

        {/* Skill pills */}
        {learningQueue.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
            {learningQueue.map(s => (
              <span key={s} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`,
              }}>
                {s}
                <span
                  onClick={() => markCompleted(s)}
                  title="Mark complete → moves to Profile skills"
                  style={{ cursor: 'pointer', color: G.green, fontWeight: 800, fontSize: 12, marginLeft: 2 }}
                >✓</span>
                <span
                  onClick={() => removeFromQueue(s)}
                  title="Remove"
                  style={{ cursor: 'pointer', color: G.text3, fontWeight: 700, fontSize: 11 }}
                >✕</span>
              </span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: G.text3, flex: 1 }}>Empty — click any skill gap below to add</span>
        )}

        {/* Add custom */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <input
            className="input"
            placeholder="Add skill…"
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
            style={{ fontSize: 12, padding: '5px 10px', width: 140, height: 30 }}
          />
          <button className="btn btn-primary btn-sm" onClick={addCustomSkill} style={{ height: 30, padding: '0 12px', fontSize: 12 }}>+ Add</button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: `1px solid ${G.border}`, paddingBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '7px 18px', borderRadius: 7, border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: activeTab === t.id ? G.text : G.bg2,
              color: activeTab === t.id ? G.white : G.text2,
              transition: 'all 0.2s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TAB: Priorities                                                      */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {
        activeTab === 'priorities' && (
          <div className="sg-in">
            {/* Cards grid */}
            <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.amber}08`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: G.amber }}>
                    Top Priority Skills for {selectedRole}
                  </h3>
                  <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0' }}>
                    Scraped from live Naukri / LinkedIn job postings · ordered by interview frequency
                  </p>
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${G.amber}15`, color: G.amber, border: `1px solid ${G.amberBd}`, fontWeight: 700 }}>
                  {sortedPriorities.length} skills
                </span>
              </div>

              <div style={{ padding: 16 }}>
                {sortedPriorities.length === 0 ? (
                  /* Only show "all covered" if matched > 0 and missing === 0 */
                  missing.length === 0 && matched.length > 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px', color: G.text2 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: G.green }}>All priorities covered!</div>
                      <p style={{ fontSize: 12, color: G.text2, margin: '6px 0 0' }}>
                        You already have all the required skills for {selectedRole} based on live job data.
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 16px', color: G.text2 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>No priority data yet</div>
                      <p style={{ fontSize: 12, color: G.text3, margin: '6px 0 12px' }}>
                        The ML analyzer couldn't extract priorities for this role. Try refreshing.
                      </p>
                      <button className="btn btn-secondary btn-sm" onClick={() => loadAnalysis(selectedRole)}>
                        Retry Analysis
                      </button>
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sortedPriorities.map((skill, i) => (
                      <div key={i}
                        className="sg-card sg-chip"
                        onClick={() => addToQueue(skill.skill)}
                        title={`PRO TIP: ${skill.recommendation}\nClick to add to queue`}
                        style={{
                          padding: '10px 14px', borderRadius: 8,
                          border: `1px solid ${urgencyBd[skill.urgency] || G.border}`,
                          background: `${urgencyBg[skill.urgency] || G.bg}88`,
                          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
                        }}>
                        
                        {/* Rank */}
                        <div style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#ca8a04' : G.bg2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800, color: i < 3 ? G.white : G.text3, flexShrink: 0
                        }}>#{i + 1}</div>
                        
                        {/* Main info */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: G.text, display: 'flex', gap: 8, alignItems: 'center' }}>
                            {skill.skill} <UrgencyBadge urgency={skill.urgency || 'Medium'} />
                          </div>
                          <div style={{ fontSize: 11, color: G.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {skill.description}
                          </div>
                        </div>

                        {/* Impact + Freq inline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          <div style={{ width: 60 }}>
                            <div style={{ fontSize: 9, color: G.text3, fontWeight: 600, marginBottom: 2 }}>IMPACT</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MiniBar value={skill.priority_score || 80} color={urgencyColor[skill.urgency] || G.blue} />
                              <span style={{ fontSize: 10, fontWeight: 700 }}>{skill.priority_score || 80}%</span>
                            </div>
                          </div>
                          
                          <div style={{ fontSize: 11, color: G.text3, fontWeight: 600, width: 40, textAlign: 'right' }}>
                            ~{Math.ceil((skill.time_to_proficiency_days || 30) / 7)}w
                          </div>
                          <span style={{ color: G.blue, fontSize: 18, fontWeight: 800, paddingLeft: 8 }}>+</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ranked table */}
            {sortedPriorities.length > 0 && (
              <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${G.border}` }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Full Ranked Table</h3>
                  <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0' }}>
                    All missing skills ranked for {selectedRole} from live job data
                  </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: G.bg }}>
                        {['#', 'Skill', 'Urgency', 'Impact', 'Interview Freq', 'Est. Time', 'Action'].map(h => (
                          <th key={h} style={{
                            padding: '8px 14px', textAlign: h === 'Skill' ? 'left' : 'center',
                            fontSize: 10, fontWeight: 700, color: G.text3,
                            borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPriorities.map((skill, i) => (
                        <tr key={i} className="sg-row"
                          style={{ borderBottom: `1px solid ${G.border}`, transition: 'background 0.15s' }}>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: G.text3, textAlign: 'center', fontWeight: 700 }}>
                            {i + 1}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {skill.skill}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <UrgencyBadge urgency={skill.urgency || 'Medium'} />
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <MiniBar value={skill.priority_score || 80} color={G.amber} />
                              <span style={{ fontSize: 10, color: G.text2, width: 30 }}>{skill.priority_score || 80}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <MiniBar value={skill.interview_frequency || 75} color={G.purple} />
                              <span style={{ fontSize: 10, color: G.text2, width: 30 }}>{skill.interview_frequency || 75}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: G.text2 }}>
                            {Math.ceil((skill.time_to_proficiency_days || 30) / 7)}w
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              onClick={() => addToQueue(skill.skill)}
                              style={{
                                padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                                background: G.blueBg, color: G.blue,
                                border: `1px solid ${G.blueBd}`, cursor: 'pointer',
                              }}>+ Queue</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      }

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TAB: AI Action Plan                                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {
        activeTab === 'ai' && aiRec && (
          <div className="sg-in">
            <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.blue}08` }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: G.blue }}>
                  🤖 AI-Powered Insights for {selectedRole}
                </h3>
                <p style={{ fontSize: 11, color: G.text2, margin: '2px 0 0' }}>
                  Personalized plan based on your skills + live job-market data
                </p>
              </div>
              <div style={{ padding: 16 }}>

                {/* Assessment + ETA */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, marginBottom: 20, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G.text, marginBottom: 6 }}>Your Assessment</div>
                    <p style={{ fontSize: 12, color: G.text2, lineHeight: 1.6, margin: 0 }}>{aiRec.analysis}</p>
                  </div>
                  <div style={{
                    textAlign: 'center', padding: '16px 22px', borderRadius: 10,
                    background: `${G.blue}08`, border: `1px solid ${G.blueBd}`, flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 34, fontWeight: 800, color: G.blue, lineHeight: 1 }}>
                      {aiRec.estimated_time_to_ready_weeks}
                    </div>
                    <div style={{ fontSize: 9, color: G.text3, marginTop: 5, fontWeight: 700, letterSpacing: '0.06em' }}>
                      WEEKS TO<br />READY
                    </div>
                  </div>
                </div>

                {/* Action plan */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: G.text, marginBottom: 10 }}>Recommended Action Plan</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                    {aiRec.action_plan?.map((phase, i) => (
                      <div key={i} style={{
                        padding: '12px 14px', borderRadius: 8,
                        border: `1px solid ${G.border}`, background: G.bg,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: G.blue, marginBottom: 4, letterSpacing: '0.06em' }}>
                          WEEK {phase.week}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 4 }}>{phase.focus}</div>
                        <div style={{ fontSize: 11, color: G.text2, lineHeight: 1.4 }}>{phase.action}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Steps + Gaps */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ padding: '14px 16px', borderRadius: 10, border: `1px solid ${G.greenBd}`, background: G.greenBg }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G.green, marginBottom: 10 }}>✅ Next Steps</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {aiRec.next_steps?.map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: G.text2, lineHeight: 1.4 }}>
                          <span style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            background: G.green, color: G.white,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 800,
                          }}>{i + 1}</span>
                          <span>{step.replace(/^\d+\.\s*/, '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '14px 16px', borderRadius: 10, border: `1px solid ${G.redBd}`, background: G.redBg }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G.red, marginBottom: 10 }}>⚠️ Critical Gaps (from live data)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(aiRec.weaknesses || []).map((w, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: G.text2, lineHeight: 1.4 }}>
                          <span style={{ color: G.red, flexShrink: 0, marginTop: 1 }}>•</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: G.text, color: G.white, padding: '12px 24px', borderRadius: 99,
          fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fadeUp 0.3s ease'
        }}>
          {toastMsg}
        </div>
      )}
    </div >
  );
}