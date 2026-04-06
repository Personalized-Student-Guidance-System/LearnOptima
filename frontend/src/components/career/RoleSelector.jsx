// src/components/career/RoleSelector.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-page role-picker shown when no role is selected yet.
// Also used as the inline "Switch roles" strip inside the roadmap view.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { G } from '../../design/tokens';

// ── Skeleton for the full-page picker ────────────────────────────────────────
export function SkeletonRoleSelector({ count = 8 }) {
  const shimmer = {
    background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 24, height: 80, opacity: 0.7, ...shimmer }} />
      ))}
    </div>
  );
}

// ── Full-page picker ──────────────────────────────────────────────────────────
export function RoleSelectorPage({ roles, onSelect }) {
  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Build Your Career Roadmap
        </h1>
        <p style={{ fontSize: 14, color: G.text2, marginTop: 2 }}>
          Select your target role to get a personalized career path with recommended skills,
          learning resources, and live job opportunities.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {roles.map((r) => (
          <div
            key={r}
            onClick={() => onSelect(r)}
            className="card"
            style={{
              padding: 24, cursor: 'pointer',
              border: `2px solid ${G.border}`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = G.blue;
              e.currentTarget.style.background  = G.bg2;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = G.border;
              e.currentTarget.style.background  = G.white;
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: G.text, marginBottom: 8 }}>{r}</div>
            <div style={{ fontSize: 12, color: G.text2, lineHeight: 1.5 }}>
              I want to become a {r.toLowerCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline strip used inside the roadmap view ─────────────────────────────────
export function RoleSwitcher({ roles, currentRole, onSelect }) {
  return (
    <div className="card card-md" style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: G.text3,
        marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        Switch roles
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(r)}
            className="btn btn-sm"
            style={{
              background: r === currentRole ? G.blue  : G.white,
              color:      r === currentRole ? G.white : G.text,
              border:     `2px solid ${r === currentRole ? G.blue : G.border}`,
              fontWeight: r === currentRole ? 700 : 500,
            }}
          >
            {r === currentRole ? '✓ ' : ''}{r}
          </button>
        ))}
      </div>
    </div>
  );
}