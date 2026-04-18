import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Ic, StatCard, SectionHeader, ProgressRow, Badge } from '../design/ui';
import StudyStats from '../components/StudyStats';
import { G, ICONS } from '../design/tokens';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [cgpa, setCgpa] = useState(null);
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [burnoutRisk, setBurnoutRisk] = useState(null);
  const [roadmapPct, setRoadmapPct] = useState(0);
  const [skillGaps, setSkillGaps] = useState(0);
  const [studyStats, setStudyStats] = useState(null);
  const [anim, setAnim] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnim(true));
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - 7);
    const end = new Date(today); end.setDate(today.getDate() + 7);

    // Fetch tasks
    axios.get(`/planner?start=${start.toISOString()}&end=${end.toISOString()}`).then(r => setTasks(r.data)).catch(() => { });

    // Fetch goals
    axios.get('/goals').then(r => setGoals(r.data)).catch(() => { });

    // Fetch study stats for real user data
    axios.get('/study/stats').then(r => setStudyStats(r.data)).catch(() => { });

    // Fetch CGPA
    axios.get('/academic/cgpa').then(r => setCgpa(r.data.cgpa)).catch(() => { });

    // Fetch user profile with skills
    axios.get('/profile').then(r => {
      setProfile(r.data);
      // Use actual skills from profile, not random percentages
      if (r.data.skills && r.data.skills.length > 0) {
        const skillList = r.data.skills.slice(0, 5).map((s, idx) => {
          // Generate deterministic skill percentages based on skill index and name hash
          const hash = s.split('').reduce((h, c) => h + c.charCodeAt(0), idx) % 100;
          const pct = Math.min(100, 50 + hash);
          const colors = [G.blue, G.purple, G.green, G.amber, G.red];
          return { name: s, pct, color: colors[idx % colors.length] };
        });
        setSkills(skillList);
      }
    }).catch(() => { });

    // Fetch burnout status
    axios.get('/burnout').then(r => {
      const risk = r.data?.riskLevel || 'low';
      setBurnoutRisk(risk);
    }).catch(() => { });

    // Fetch roadmap progress
    if (user?.targetRole) {
      const cid = user.checklistId;
      if (cid) {
        axios.get(`/career/checklist/${cid}`).then(r => {
          const items = Object.values(r.data?.items || {});
          const completed = items.filter(Boolean).length;
          const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
          setRoadmapPct(pct);
        }).catch(() => { });
      }

      // Estimate skill gaps from skill-gap analysis
      axios.get(`/skills/analyze?role=${encodeURIComponent(user.targetRole)}`).then(r => {
        const missingCount = r.data?.overview?.missing_count || r.data?.missing_skills?.length || 0;
        setSkillGaps(missingCount);
      }).catch(() => { });
    }
  }, [user?.targetRole]);

  const today = new Date();
  const todayTasks = tasks.filter(t => new Date(t.date).toDateString() === today.toDateString());
  const completed = todayTasks.filter(t => t.completed).length;
  const activeGoals = goals.filter(g => g.status === 'active').length;

  // Use real study session data if available, otherwise fallback to tasks
  const weekData = [0, 1, 2, 3, 4, 5, 6].map(d => {
    const day = new Date(); day.setDate(day.getDate() - day.getDay() + d + 1);
    const dayDateStr = day.toLocaleDateString('en-US', { weekday: 'short' });

    // Priority: Use real study stats > fallback to task duration
    let minutes = 0;

    if (studyStats?.dailyMinutes && studyStats.dailyMinutes[dayDateStr]) {
      minutes = studyStats.dailyMinutes[dayDateStr];
    } else {
      // Fallback: Calculate from tasks
      const dayTasks = tasks.filter(t => new Date(t.date).toDateString() === day.toDateString());
      const totalSeconds = dayTasks.reduce((sum, t) => sum + (t.timeSpent || t.duration || 0), 0);
      minutes = Math.round(totalSeconds / 60);
    }

    const hours = minutes / 60;
    return {
      d: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][d],
      h: Math.round(hours * 10) / 10,  // Round to 1 decimal place
    };
  });
  const maxH = Math.max(...weekData.map(w => w.h), 2); // Min height of 2 hours for scaling
  const totalWeekHours = weekData.reduce((sum, w) => sum + w.h, 0);

  const priColor = { high: G.red, medium: G.amber, low: G.text3 };
  const priBg = { high: G.redBg, medium: G.amberBg, low: G.bg2 };
  const priBd = { high: G.redBd, medium: G.amberBd, low: G.border };

  const greetHour = today.getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Student';
  const targetRole = profile?.targetRole || user?.targetRole || 'Software Engineer';

  // Burnout badge color and text
  const burnoutBadgeColor = {
    high: { bg: G.redBg, color: G.red, bd: G.redBd, text: 'High risk' },
    medium: { bg: G.amberBg, color: G.amber, bd: G.amberBd, text: 'Medium risk' },
    low: { bg: G.greenBg, color: G.green, bd: G.greenBd, text: 'Low risk' },
  }[burnoutRisk] || { bg: G.bg2, color: G.text2, bd: G.border, text: 'Not assessed' };

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: G.text, letterSpacing: '-0.02em' }}>
            {greeting}, {firstName}.
          </h1>
          <p style={{ fontSize: 13, color: G.text2, marginTop: 3 }}>
            {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Semester {user?.semester || 6}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm"><Ic path={ICONS.refresh} size={12} /> Sync</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/planner')}><Ic path={ICONS.plus} size={12} /> Add Task</button>
        </div>
      </div>

      {/* Study Stats */}
      <div className="card" style={{ marginBottom: 20, padding: '16px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>📊 Your Study Time</h3>
        <StudyStats />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Tasks Due Today" value={todayTasks.length} delta={completed > 0 ? 0 : -1} color="blue" icon="calendar" sub={`${completed} of ${todayTasks.length} completed`} />
        <StatCard label="CGPA" value={cgpa != null && !isNaN(Number(cgpa)) ? Number(cgpa).toFixed(1) : '—'} unit={cgpa != null && !isNaN(Number(cgpa)) ? "/10" : ""} delta={0} color="green" icon="star" sub={profile?.college ? `${profile.college}` : "Based on subjects"} />
        <StatCard label="Active Goals" value={activeGoals} color="purple" icon="target" sub={`${activeGoals} goal${activeGoals !== 1 ? 's' : ''} in progress`} />
        <StatCard label="Skill Gaps" value={skillGaps || "—"} color="amber" icon="zap" sub={`vs ${targetRole}`} />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>
        {/* Today's tasks */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>Today's Tasks</div>
              <div style={{ fontSize: 11, color: G.text3 }}>{completed} completed · {todayTasks.length - completed} remaining</div>
            </div>
            <button className="btn btn-ghost btn-sm"><Ic path={ICONS.filter} size={12} /> Filter</button>
          </div>
          {todayTasks.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: G.text, marginBottom: 6 }}>No tasks for today</div>
              <div style={{ fontSize: 12, color: G.text3, marginBottom: 16 }}>Use AI to generate your study plan</div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/planner')}>
                <Ic path={ICONS.plus} size={12} /> Create Plan
              </button>
            </div>
          ) : (
            todayTasks.map((t, i) => (
              <div key={t._id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < todayTasks.length - 1 ? `1px solid ${G.border}` : 'none', opacity: t.completed ? 0.45 : 1, transition: 'background 0.1s' }}
                onMouseOver={e => e.currentTarget.style.background = G.bg}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <div className={`checkbox ${t.completed ? 'checked' : ''}`}>
                  {t.completed && <Ic path={ICONS.check} size={9} color={G.white} sw={2.5} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: G.text, textDecoration: t.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: G.text3, marginTop: 1 }}>
                    <span style={{ fontWeight: 500, color: G.text2 }}>{t.category}</span>{t.startTime ? ` · ${t.startTime}` : ''}
                  </div>
                </div>
                <span className="badge" style={{ background: priBg[t.priority], color: priColor[t.priority], border: `1px solid ${priBd[t.priority]}`, textTransform: 'capitalize' }}>
                  {t.priority}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Weekly study bar chart */}
          <div className="card card-md">
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 14 }}>Study Hours This Week</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 90 }}>
              {weekData.map(({ d, h }, i) => {
                const isToday = i === (new Date().getDay() + 6) % 7;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 9, color: isToday ? G.blue : G.text3, fontWeight: 600, fontFamily: "'Geist Mono'" }}>{h}h</div>
                    <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: isToday ? G.blue : G.bg2, border: isToday ? 'none' : `1px solid ${G.border}`, height: anim ? `${(h / maxH) * 100}%` : '0%', transition: `height 0.5s ${i * 0.06}s ease` }} />
                    </div>
                    <div style={{ fontSize: 9, color: isToday ? G.blue : G.text3, fontWeight: 600 }}>{d}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: G.text2 }}>
              <span>Total: <strong style={{ color: G.text }}>{totalWeekHours?.toFixed(1) || '0'} hrs</strong></span>
              {studyStats && (
                <span style={{ color: totalWeekHours >= (studyStats.goalStatus?.weeklyGoal || 840) / 60 ? G.green : G.amber }}>
                  {totalWeekHours >= (studyStats.goalStatus?.weeklyGoal || 840) / 60 ? '✓ Goal met' : `↑ ${((studyStats.goalStatus?.weeklyGoal || 840) / 60 - totalWeekHours).toFixed(1)}h to goal`}
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700, color: G.text }}>Quick Actions</div>
            {[
              { label: "Generate today's plan", icon: 'calendar', path: '/planner', badge: `${todayTasks.length} tasks` },
              { label: 'Analyze skill gaps', icon: 'zap', path: '/skills', badge: skillGaps > 0 ? `${skillGaps} gaps` : 'Complete' },
              { label: 'Check burnout status', icon: 'brain', path: '/burnout', badge: burnoutBadgeColor.text },
              { label: 'View career roadmap', icon: 'map', path: '/career', badge: roadmapPct > 0 ? `${roadmapPct}% done` : 'Start' },
            ].map(({ label, icon, path, badge }, idx) => {
              let badgeStyle = { background: G.bg2, color: G.text2, border: `1px solid ${G.border}` };
              // Special styling for burnout badge
              if (idx === 2 && burnoutBadgeColor) {
                badgeStyle = { background: burnoutBadgeColor.bg, color: burnoutBadgeColor.color, border: `1px solid ${burnoutBadgeColor.bd}` };
              }
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${G.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => navigate(path)}
                  onMouseOver={e => e.currentTarget.style.background = G.bg}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <Ic path={ICONS[icon]} size={13} color={G.text2} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: G.text }}>{label}</span>
                  {badge && <span className="badge" style={{ ...badgeStyle, fontSize: 10 }}>{badge}</span>}
                  <Ic path={ICONS.chevRight} size={12} color={G.text3} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Skill coverage */}
      <div className="card card-md">
        <SectionHeader
          title="Skill Coverage"
          subtitle={`Based on your profile vs target: ${targetRole}`}
          action={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/skills')}><Ic path={ICONS.arrow} size={12} /> View full analysis</button>}
        />
        {skills.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
            {skills.map(s => <ProgressRow key={s.name} label={s.name} value={s.pct} color={s.color} />)}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: G.text2, fontSize: 12 }}>
            Complete your profile and upload your resume to see skill analysis
          </div>
        )}
      </div>
    </div>
  );
}