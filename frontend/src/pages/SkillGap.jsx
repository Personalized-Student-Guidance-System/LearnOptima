import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Ic } from '../design/ui';
import { G, ICONS } from '../design/tokens';
import * as API from '../services/api';

const urgencyColor = { Critical: G.red,    High: G.amber,    Medium: G.blue  };
const urgencyBg    = { Critical: G.redBg,  High: G.amberBg,  Medium: G.blueBg };
const urgencyBd    = { Critical: G.redBd,  High: G.amberBd,  Medium: G.blueBd };

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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={G.bg2} strokeWidth={9} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={9}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s ease' }}
      />
      <text x={size/2} y={size/2 - 4} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 24, fontWeight: 800, fill: color }}>{score}</text>
      <text x={size/2} y={size/2 + 16} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 9, fontWeight: 600, fill: G.text3 }}>MATCH %</text>
    </svg>
  );
}

function StatPill({ label, val, color, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 80, padding: '12px 10px', borderRadius: 10,
      background: G.bg, border: `1px solid ${G.border}`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || G.text, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: G.text, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: G.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Scraping Loading Screen ───────────────────────────────────────────────────
function ScrapingLoader({ role }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: '🌐', text: `Scraping Naukri job listings for "${role}"…` },
    { icon: '🔗', text: `Scraping LinkedIn postings for "${role}"…` },
    { icon: '🤖', text: 'Regex NLP extracting skills from job descriptions…' },
    { icon: '📐', text: 'Semantic embedding & cosine similarity matching…' },
    { icon: '🎯', text: 'Prioritizing gaps by interview frequency…' },
  ];
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '52vh', gap: 24,
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeStep{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      {/* Outer ring */}
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `3px solid ${G.border2}`,
          borderTopColor: G.blue,
          animation: 'spin 0.9s linear infinite',
          position: 'absolute',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>{steps[step].icon}</div>
      </div>

      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: G.text, marginBottom: 6 }}>
          Analyzing Live Job Market
        </div>
        <div
          key={step}
          style={{
            fontSize: 13, color: G.text2, animation: 'fadeStep 0.4s ease',
            lineHeight: 1.5, minHeight: 40,
          }}
        >
          {steps[step].text}
        </div>
      </div>

      {/* Progress dots */}
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
        Scraping live job postings + NLP analysis takes ~30–60 seconds.<br />
        Results are cached for 1 hour.
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
  const [expandedGaps, setExpandedGaps] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [activeTab, setActiveTab] = useState('priorities');
  const prevRoleRef = useRef(null);

  const targetRole = user?.targetRole || 'Software Engineer';

  useEffect(() => {
    if (targetRole !== prevRoleRef.current) {
      prevRoleRef.current = targetRole;
      loadAnalysis(targetRole);
    }
  }, [targetRole]);

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
    } catch (err) { console.error(err); }
  };

  const removeFromQueue = async (skill) => {
    try {
      const res = await API.updateSkillLearningQueue(skill, 'remove');
      setData(prev => ({ ...prev, learning_queue: res.data.skillsToLearn }));
    } catch (err) { console.error(err); }
  };

  const addCustomSkill = async () => {
    if (!newSkill.trim()) return;
    await addToQueue(newSkill.trim());
    setNewSkill('');
  };

  // ─── States ─────────────────────────────────────────────────────────────────
  if (loading) return <ScrapingLoader role={targetRole} />;

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
        <button className="btn btn-primary btn-sm" onClick={() => loadAnalysis(targetRole)}>
          Retry
        </button>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ padding: 24, color: G.text2 }}>
      No data returned. <button className="btn btn-secondary btn-sm" onClick={() => loadAnalysis(targetRole)}>Retry</button>
    </div>
  );

  const overview      = data.overview || {};
  const matched       = data.matched_skills || [];
  const missing       = data.missing_skills || [];
  const topPriorities = data.top_5_priorities || [];
  const learningQueue = data.learning_queue || [];
  const score         = overview.match_score || 0;
  const scoreColor    = score >= 80 ? G.green : score >= 60 ? G.amber : score >= 40 ? G.blue : G.red;
  const scoreLabel    = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Developing' : 'Beginner';

  const sortedPriorities = [...topPriorities].sort((a, b) => {
    const o = { Critical: 0, High: 1, Medium: 2 };
    return (o[a.urgency] ?? 2) - (o[b.urgency] ?? 2);
  });

  const TABS = [
    { id: 'priorities', label: '⭐ Priorities' },
    { id: 'ai',         label: '🤖 AI Action Plan' },
  ];

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1200 }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .sg-in{animation:fadeUp 0.35s ease both}
        .sg-chip{transition:all 0.18s;cursor:pointer}
        .sg-chip:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,0.1)}
        .sg-row:hover{background:${G.bg}!important}
        .sg-card{transition:border-color 0.2s,box-shadow 0.2s}
        .sg-card:hover{border-color:${G.border2}!important;box-shadow:0 2px 14px rgba(0,0,0,0.06)!important}
      `}</style>

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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', borderRadius: 8,
          background: `${G.blue}10`, border: `1px solid ${G.blueBd}`,
        }}>
          <div>
            <div style={{ fontSize: 9, color: G.text3, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Target Role</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.blue, marginTop: 1 }}>{targetRole}</div>
          </div>
          <div style={{ width: 1, height: 26, background: G.blueBd }} />
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 10, padding: '3px 8px' }}
            onClick={() => navigate('/profile')}
          >Change Role →</button>
          <button
            title="Re-run live scraping"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 6, color: G.text3,
              fontSize: 14, lineHeight: 1,
            }}
            onClick={() => loadAnalysis(targetRole, true)}
          >↺</button>
        </div>
      </div>

      {/* ── Score Banner ─────────────────────────────────────────────────── */}
      <div className="card sg-in" style={{ marginBottom: 20, padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <StatPill label="Matched"  val={overview.matched_count || 0} color={G.green}  sub={`of ${overview.total_required || 0} required`} />
            <StatPill label="To Learn" val={overview.missing_count || 0} color={G.red}    sub="identified gaps" />
            <StatPill label="In Queue" val={learningQueue.length}         color={G.blue}   sub="skills queued" />
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
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${G.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: G.text2 }}>
              Match for <span style={{ color: G.blue }}>{targetRole}</span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>{score}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: G.bg2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: 4, transition: 'width 0.8s ease' }} />
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

      {expandedGaps && (
        <div className="sg-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Matched */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.green}09` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: G.green }}>
                ✅ Your Strengths ({matched.length})
              </span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {matched.length === 0
                ? <p style={{ fontSize: 12, color: G.text3, margin: 0 }}>No matched skills yet — add skills in your Profile.</p>
                : matched.slice(0, 14).map(s => (
                    <span key={s.skill} style={{
                      padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                      background: G.greenBg, color: G.green, border: `1px solid ${G.greenBd}`,
                    }}>{s.skill}</span>
                  ))
              }
              {matched.length > 14 && (
                <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, background: G.bg2, color: G.text3, border: `1px solid ${G.border}` }}>
                  +{matched.length - 14} more
                </span>
              )}
            </div>
          </div>

          {/* Missing */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.red}09` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: G.red }}>
                📌 To Learn ({missing.length})
              </span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {missing.length === 0
                ? <p style={{ fontSize: 12, color: G.text3, margin: 0 }}>No gaps! You're well covered for {targetRole}.</p>
                : missing.slice(0, 14).map(s => (
                    <span key={s.skill}
                      className="sg-chip"
                      onClick={() => addToQueue(s.skill)}
                      title="Click to add to learning queue"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                        background: urgencyBg[s.urgency] || G.redBg,
                        color: urgencyColor[s.urgency] || G.red,
                        border: `1px solid ${urgencyBd[s.urgency] || G.redBd}`,
                      }}>
                      <UrgencyDot urgency={s.urgency} />
                      {s.skill} <span style={{ opacity: 0.6, fontSize: 10 }}>+</span>
                    </span>
                  ))
              }
            </div>
            {missing.length > 0 && (
              <div style={{ padding: '0 16px 10px', fontSize: 10, color: G.text3 }}>
                Click a skill to add it to your learning queue
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Learning Queue ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>My Learning Queue</h3>
            <p style={{ fontSize: 11, color: G.text2, margin: 0 }}>Skills you're actively working on for {targetRole}</p>
          </div>
          {learningQueue.length > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}` }}>
              {learningQueue.length} skill{learningQueue.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ padding: '14px 16px' }}>
          {learningQueue.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
              {learningQueue.map(s => (
                <span key={s} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                  background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`,
                }}>
                  {s}
                  <span onClick={() => removeFromQueue(s)} style={{
                    cursor: 'pointer', width: 14, height: 14, borderRadius: '50%',
                    background: `${G.blue}20`, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 9,
                  }}>✕</span>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: G.text3, margin: '0 0 12px' }}>
              Queue empty — click missing skills above to add, or type below.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder={`Add a skill for ${targetRole}…`}
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
              style={{ fontSize: 12 }}
            />
            <button className="btn btn-primary btn-sm" onClick={addCustomSkill}>Add</button>
          </div>
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
      {activeTab === 'priorities' && (
        <div className="sg-in">
          {/* Cards grid */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.amber}08`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: G.amber }}>
                  Top Priority Skills for {targetRole}
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
                      You already have all the required skills for {targetRole} based on live job data.
                    </p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: G.text2 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>No priority data yet</div>
                    <p style={{ fontSize: 12, color: G.text3, margin: '6px 0 12px' }}>
                      The ML analyzer couldn't extract priorities for this role. Try refreshing.
                    </p>
                    <button className="btn btn-secondary btn-sm" onClick={() => loadAnalysis(targetRole)}>
                      Retry Analysis
                    </button>
                  </div>
                )
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
                  {sortedPriorities.map((skill, i) => (
                    <div key={i}
                      className="sg-card sg-chip"
                      onClick={() => addToQueue(skill.skill)}
                      title="Click to add to queue"
                      style={{
                        padding: 14, borderRadius: 10,
                        border: `1px solid ${urgencyBd[skill.urgency] || G.border}`,
                        background: `${urgencyBg[skill.urgency] || G.bg}88`,
                      }}>
                      {/* Rank + badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 7,
                          background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#ca8a04' : G.bg2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800,
                          color: i < 3 ? G.white : G.text3,
                          flexShrink: 0,
                        }}>#{i + 1}</div>
                        <UrgencyBadge urgency={skill.urgency || 'Medium'} />
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 10 }}>
                        {skill.skill}
                      </div>

                      {/* Impact bar */}
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 9, color: G.text3, fontWeight: 600 }}>IMPACT</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: G.text }}>{skill.priority_score || 80}%</span>
                        </div>
                        <MiniBar value={skill.priority_score || 80} color={urgencyColor[skill.urgency] || G.blue} />
                      </div>

                      {/* Interview freq bar */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 9, color: G.text3, fontWeight: 600 }}>INTERVIEW FREQ</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: G.text }}>{skill.interview_frequency || 75}%</span>
                        </div>
                        <MiniBar value={skill.interview_frequency || 75} color={G.purple} />
                      </div>

                      <div style={{
                        paddingTop: 8, borderTop: `1px solid ${urgencyBd[skill.urgency] || G.border}`,
                        fontSize: 10, color: urgencyColor[skill.urgency] || G.text3,
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>⏱ ~{Math.ceil((skill.time_to_proficiency_days || 30) / 7)}w</span>
                        <span>+ Add to queue</span>
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
                  All missing skills ranked for {targetRole} from live job data
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
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TAB: AI Action Plan                                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeTab === 'ai' && aiRec && (
        <div className="sg-in">
          <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, background: `${G.blue}08` }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: G.blue }}>
                🤖 AI-Powered Insights for {targetRole}
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
      )}
    </div>
  );
}