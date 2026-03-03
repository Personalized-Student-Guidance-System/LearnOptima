import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Ic, StatCard, SectionHeader, ProgressRow, Badge } from '../design/ui';
import { G, ICONS } from '../design/tokens';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks,   setTasks]   = useState([]);
  const [goals,   setGoals]   = useState([]);
  const [cgpa,    setCgpa]    = useState(null);
  const [anim,    setAnim]    = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnim(true));
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - 7);
    const end   = new Date(today); end.setDate(today.getDate() + 7);
    axios.get(`/planner?start=${start.toISOString()}&end=${end.toISOString()}`).then(r => setTasks(r.data)).catch(() => {});
    axios.get('/goals').then(r => setGoals(r.data)).catch(() => {});
    axios.get('/academic/cgpa').then(r => setCgpa(r.data.cgpa)).catch(() => {});
  }, []);

  const today      = new Date();
  const todayTasks = tasks.filter(t => new Date(t.date).toDateString() === today.toDateString());
  const completed  = todayTasks.filter(t => t.completed).length;
  const activeGoals = goals.filter(g => g.status === 'active').length;

  const weekData = [0,1,2,3,4,5,6].map(d => {
    const day = new Date(); day.setDate(day.getDate() - day.getDay() + d + 1);
    return {
      d: ['M','T','W','T','F','S','S'][d],
      h: tasks.filter(t => new Date(t.date).toDateString() === day.toDateString()).length * 1.5 || Math.floor(Math.random() * 6 + 2),
    };
  });
  const maxH = Math.max(...weekData.map(w => w.h), 1);

  const priColor = { high: G.red, medium: G.amber, low: G.text3 };
  const priBg    = { high: G.redBg, medium: G.amberBg, low: G.bg2 };
  const priBd    = { high: G.redBd, medium: G.amberBd, low: G.border };

  const greetHour = today.getHours();
  const greeting  = greetHour < 12 ? 'Good morning' : greetHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Student';

  const skills = [
    { name: 'Data Structures & Algorithms', pct: 72, color: G.blue },
    { name: 'Machine Learning',             pct: 38, color: G.purple },
    { name: 'Web Development',             pct: 55, color: G.green },
    { name: 'Database Systems',            pct: 64, color: G.amber },
    { name: 'System Design',               pct: 25, color: G.red },
  ];

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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Tasks Due Today"  value={todayTasks.length} delta={-12} color="blue"   icon="calendar" sub={`${completed} of ${todayTasks.length} completed`} />
        <StatCard label="CGPA"             value={cgpa || '8.4'} unit="/10" delta={4} color="green" icon="star" sub="Based on all subjects" />
        <StatCard label="Active Goals"     value={activeGoals || 4} color="purple" icon="target" sub="Click to view all goals" />
        <StatCard label="Skill Gap Score"  value="54" unit="%" delta={8} color="amber" icon="zap" sub="vs Software Engineer role" />
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
              <span>Total: <strong style={{ color: G.text }}>35.5 hrs</strong></span>
              <span style={{ color: G.green }}>↑ +4h vs last week</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700, color: G.text }}>Quick Actions</div>
            {[
              { label: "Generate today's plan",  icon: 'calendar', path: '/planner',  badge: null },
              { label: 'Analyze skill gaps',     icon: 'zap',      path: '/skills',   badge: '8 gaps' },
              { label: 'Check burnout status',   icon: 'brain',    path: '/burnout',  badge: 'Low risk' },
              { label: 'View career roadmap',    icon: 'map',      path: '/career',   badge: '54% done' },
            ].map(({ label, icon, path, badge }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${G.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                onClick={() => navigate(path)}
                onMouseOver={e => e.currentTarget.style.background = G.bg}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <Ic path={ICONS[icon]} size={13} color={G.text2} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: G.text }}>{label}</span>
                {badge && <span className="badge" style={{ background: G.bg2, color: G.text2, border: `1px solid ${G.border}`, fontSize: 10 }}>{badge}</span>}
                <Ic path={ICONS.chevRight} size={12} color={G.text3} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skill coverage */}
      <div className="card card-md">
        <SectionHeader
          title="Skill Coverage"
          subtitle={`Based on your profile vs target role: ${user?.targetRole || 'Software Engineer'}`}
          action={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/skills')}><Ic path={ICONS.arrow} size={12} /> View full analysis</button>}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          {skills.map(s => <ProgressRow key={s.name} label={s.name} value={s.pct} color={s.color} />)}
        </div>
      </div>
    </div>
  );
}