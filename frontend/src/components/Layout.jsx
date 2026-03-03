import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Ic } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const NAV = [
  { path: '/dashboard', label: 'Dashboard',      icon: 'home' },
  { path: '/planner',   label: 'Planner',        icon: 'calendar' },
  { path: '/skills',    label: 'Skill Gap',      icon: 'zap' },
  { path: '/career',    label: 'Career Roadmap', icon: 'map' },
  { path: '/burnout',   label: 'Burnout Check',  icon: 'brain' },
  { path: '/goals',     label: 'Goal Tracker',   icon: 'target' },
  { path: '/academic',  label: 'Academics',      icon: 'book' },
  { path: '/profile',   label: 'Profile',        icon: 'user' },
];

function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'S';

  return (
    <aside style={{
      width: collapsed ? 52 : 220, flexShrink: 0,
      background: G.bg, borderRight: `1px solid ${G.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      transition: 'width 0.2s ease', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '16px 14px' : '16px', borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', gap: 10, minHeight: 56 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
            <path d="M6 1L10.5 4V8L6 11L1.5 8V4L6 1Z"/>
          </svg>
        </div>
        {!collapsed && (
          <span style={{ fontWeight: 700, fontSize: 14, color: G.text, letterSpacing: '-0.01em' }}>
            StudentFriend
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {!collapsed && (
          <div style={{ padding: '4px', marginBottom: 4, fontSize: 11, fontWeight: 600, color: G.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Navigation
          </div>
        )}
        {NAV.map(({ path, label, icon }) => {
          const active = location.pathname === path;
          return (
            <Link key={path} to={path}
              className={`nav-link ${active ? 'active' : ''}`}
              style={{ marginBottom: 1, justifyContent: collapsed ? 'center' : 'flex-start', textDecoration: 'none' }}
              title={collapsed ? label : ''}>
              <Ic path={ICONS[icon]} size={15} color={active ? G.text : G.text2} sw={active ? 2 : 1.6} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {!collapsed ? (
        <div style={{ padding: '10px 8px', borderTop: `1px solid ${G.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}
            onMouseOver={e => e.currentTarget.style.background = G.bg2}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: G.white, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: G.text, lineHeight: 1.3 }}>{user?.name || 'Student'}</div>
              <div style={{ fontSize: 11, color: G.text3, lineHeight: 1.2 }}>{user?.branch || 'CS'} · Sem {user?.semester || 6}</div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              title="Logout">
              <Ic path={ICONS.logout} size={13} color={G.text3} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '10px 8px', borderTop: `1px solid ${G.border}` }}>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'center', padding: '6px' }}>
            <Ic path={ICONS.logout} size={15} color={G.text3} />
          </button>
        </div>
      )}
    </aside>
  );
}

function Topbar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const titles = {
    '/dashboard': 'Dashboard', '/planner': 'Planner',
    '/skills': 'Skill Gap Analyzer', '/career': 'Career Roadmap',
    '/burnout': 'Burnout Predictor', '/goals': 'Goal Tracker',
    '/academic': 'Academics', '/profile': 'Profile',
  };

  return (
    <div style={{ height: 52, background: G.white, borderBottom: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, position: 'sticky', top: 0, zIndex: 20 }}>
      <button className="btn btn-ghost" style={{ padding: '5px 6px' }} onClick={() => setCollapsed(v => !v)}>
        <Ic path={ICONS.menu} size={15} color={G.text2} />
      </button>
      <div style={{ width: 1, height: 18, background: G.border }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{titles[location.pathname] || 'Dashboard'}</span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: G.greenBg, border: `1px solid ${G.greenBd}` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: G.green }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: G.green }}>AI Active</span>
        </div>
        <button className="btn btn-secondary btn-sm">
          <Ic path={ICONS.bell} size={13} /> Alerts
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar collapsed={collapsed} setCollapsed={setCollapsed} />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}