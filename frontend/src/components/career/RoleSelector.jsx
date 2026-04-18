// src/components/career/RoleSelector.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-page role-picker shown when no role is selected yet.
// Also used as the inline "Switch roles" strip inside the roadmap view.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { G } from '../../design/tokens';

// ── Role metadata: emoji + short description + category colour ─────────────
const ROLE_META = {
  // 💻 Technology
  'Software Engineer':        { icon:'💻', desc:'Build scalable software systems',        cat:'Technology',    catColor:'#3b82f6' },
  'Frontend Developer':       { icon:'🌐', desc:'Craft stunning web interfaces',           cat:'Technology',    catColor:'#3b82f6' },
  'Backend Developer':        { icon:'⚙️', desc:'Power APIs and server-side logic',        cat:'Technology',    catColor:'#3b82f6' },
  'Full Stack Developer':     { icon:'🔄', desc:'Build end-to-end web applications',       cat:'Technology',    catColor:'#3b82f6' },
  'Mobile Developer':         { icon:'📱', desc:'Create iOS and Android apps',             cat:'Technology',    catColor:'#3b82f6' },
  'DevOps Engineer':          { icon:'🚀', desc:'Automate infrastructure and deployments', cat:'Technology',    catColor:'#3b82f6' },
  'Cloud Architect':          { icon:'☁️', desc:'Design scalable cloud solutions',         cat:'Technology',    catColor:'#3b82f6' },
  'Cybersecurity Engineer':   { icon:'🔒', desc:'Protect systems from threats',            cat:'Technology',    catColor:'#3b82f6' },
  'Blockchain Developer':     { icon:'⛓️', desc:'Build decentralised applications',        cat:'Technology',    catColor:'#3b82f6' },
  'Embedded Systems Engineer':{ icon:'🔌', desc:'Program hardware at the lowest level',   cat:'Technology',    catColor:'#3b82f6' },
  // 🤖 Data & AI
  'Data Scientist':           { icon:'📊', desc:'Extract insights from complex data',      cat:'Data & AI',     catColor:'#8b5cf6' },
  'ML Engineer':              { icon:'🤖', desc:'Build and deploy machine learning models',cat:'Data & AI',     catColor:'#8b5cf6' },
  'AI Research Scientist':    { icon:'🧠', desc:'Advance the frontier of AI research',     cat:'Data & AI',     catColor:'#8b5cf6' },
  'Data Analyst':             { icon:'📈', desc:'Turn data into actionable decisions',     cat:'Data & AI',     catColor:'#8b5cf6' },
  'Data Engineer':            { icon:'🛠️', desc:'Design pipelines and data infrastructure',cat:'Data & AI',     catColor:'#8b5cf6' },
  'NLP Engineer':             { icon:'💬', desc:'Build language understanding systems',     cat:'Data & AI',     catColor:'#8b5cf6' },
  // 🏥 Healthcare
  'Nurse':                    { icon:'🏥', desc:'Deliver compassionate patient care',       cat:'Healthcare',    catColor:'#10b981' },
  'Doctor':                   { icon:'⚕️', desc:'Diagnose and treat medical conditions',   cat:'Healthcare',    catColor:'#10b981' },
  'Biomedical Engineer':      { icon:'🔬', desc:'Bridge engineering and medicine',         cat:'Healthcare',    catColor:'#10b981' },
  'Clinical Data Analyst':    { icon:'🩺', desc:'Analyse clinical trial and patient data', cat:'Healthcare',    catColor:'#10b981' },
  'Public Health Specialist': { icon:'🌍', desc:'Improve population health outcomes',      cat:'Healthcare',    catColor:'#10b981' },
  // 💼 Business
  'Product Manager':          { icon:'📋', desc:'Lead products from vision to launch',     cat:'Business',      catColor:'#f59e0b' },
  'Business Analyst':         { icon:'📉', desc:'Bridge business needs and solutions',     cat:'Business',      catColor:'#f59e0b' },
  'Project Manager':          { icon:'🗂️', desc:'Deliver projects on time and budget',     cat:'Business',      catColor:'#f59e0b' },
  'Marketing Analyst':        { icon:'📣', desc:'Drive growth through data-driven marketing',cat:'Business',    catColor:'#f59e0b' },
  'HR Manager':               { icon:'👥', desc:'Attract, develop, and retain talent',     cat:'Business',      catColor:'#f59e0b' },
  'Operations Manager':       { icon:'⚡', desc:'Optimise business processes at scale',    cat:'Business',      catColor:'#f59e0b' },
  // 💰 Finance
  'Investment Banker':        { icon:'🏦', desc:'Execute high-stakes financial transactions',cat:'Finance',     catColor:'#ef4444' },
  'Financial Analyst':        { icon:'💹', desc:'Model valuations and financial forecasts',cat:'Finance',       catColor:'#ef4444' },
  'Quant Analyst':            { icon:'📐', desc:'Apply maths to financial markets',        cat:'Finance',       catColor:'#ef4444' },
  'Risk Manager':             { icon:'⚖️', desc:'Identify and mitigate financial risks',   cat:'Finance',       catColor:'#ef4444' },
  'FinTech Developer':        { icon:'💳', desc:'Build financial technology products',      cat:'Finance',       catColor:'#ef4444' },
  // 🎨 Creative
  'UI/UX Designer':           { icon:'🎨', desc:'Design beautiful, usable experiences',    cat:'Creative',      catColor:'#ec4899' },
  'Graphic Designer':         { icon:'🖌️', desc:'Create compelling visual identities',     cat:'Creative',      catColor:'#ec4899' },
  'Game Developer':           { icon:'🎮', desc:'Build immersive game worlds',             cat:'Creative',      catColor:'#ec4899' },
  'Content Strategist':       { icon:'✍️', desc:'Shape brand narratives and content',      cat:'Creative',      catColor:'#ec4899' },
  'Video Producer':           { icon:'🎬', desc:'Create engaging video content',           cat:'Creative',      catColor:'#ec4899' },
  // 🏛️ Government
  'UPSC Civil Services':      { icon:'🏛️', desc:'Serve India through IAS / IPS / IFS',    cat:'Government',    catColor:'#6366f1' },
  'Government Data Analyst':  { icon:'📑', desc:'Drive data-informed public policy',       cat:'Government',    catColor:'#6366f1' },
  'Policy Researcher':        { icon:'🔍', desc:'Research and shape public policies',      cat:'Government',    catColor:'#6366f1' },
  // 🔬 Science & Engineering
  'Research Scientist':       { icon:'🔬', desc:'Discover new knowledge through research', cat:'Science',       catColor:'#0891b2' },
  'Environmental Scientist':  { icon:'🌿', desc:'Protect and study the environment',       cat:'Science',       catColor:'#0891b2' },
  'Mechanical Engineer':      { icon:'⚙️', desc:'Design and build mechanical systems',     cat:'Science',       catColor:'#0891b2' },
  'Electrical Engineer':      { icon:'⚡', desc:'Design circuits and electrical systems',  cat:'Science',       catColor:'#0891b2' },
  'Chemical Engineer':        { icon:'⚗️', desc:'Transform raw materials into products',   cat:'Science',       catColor:'#0891b2' },
};

function getRoleMeta(role) {
  return ROLE_META[role] || { icon: '🎯', desc: `Pursue a career as a ${role}`, cat: 'Career', catColor: G.blue };
}

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
        <div key={i} className="card" style={{ padding: 24, height: 96, opacity: 0.7, ...shimmer }} />
      ))}
    </div>
  );
}

// ── Full-page picker ──────────────────────────────────────────────────────────
export function RoleSelectorPage({ roles, onSelect }) {
  const [search, setSearch] = useState('');

  const filtered = roles.filter(r =>
    r.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const groups = {};
  filtered.forEach(r => {
    const meta = getRoleMeta(r);
    if (!groups[meta.cat]) groups[meta.cat] = { color: meta.catColor, roles: [] };
    groups[meta.cat].roles.push(r);
  });

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>
          🗺️ Build Your Career Roadmap
        </h1>
        <p style={{ fontSize: 14, color: G.text2, marginTop: 0, marginBottom: 16 }}>
          Select a target role to get a personalised learning path with curated skills,
          resources, and live job opportunities.
        </p>
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 600 }}>
          <input
            type="text"
            placeholder="🔍  Search or enter ANY custom role (e.g. Quantum Engineer)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: '9px 14px',
              fontSize: 13, border: `1.5px solid ${G.border}`, borderRadius: 8,
              outline: 'none', color: G.text, background: G.white,
              boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = G.blue; }}
            onBlur={e  => { e.target.style.borderColor = G.border; }}
            onKeyDown={e => { if(e.key === 'Enter' && search.trim()) onSelect(search.trim()) }}
          />
          {search.trim() && (
            <button 
              className="btn btn-primary" 
              onClick={() => onSelect(search.trim())}
              style={{ flexShrink: 0 }}
            >
              🚀 Analyze "{search.trim()}"
            </button>
          )}
        </div>
      </div>

      {Object.entries(groups).map(([cat, { color, roles: catRoles }]) => (
        <div key={cat} style={{ marginBottom: 28 }}>
          {/* Category header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <div style={{
              width: 3, height: 16, borderRadius: 2, background: color, flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              {cat}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {catRoles.map((r) => {
              const meta = getRoleMeta(r);
              return (
                <div
                  key={r}
                  onClick={() => onSelect(r)}
                  className="card"
                  style={{
                    padding: '16px 18px', cursor: 'pointer',
                    border: `1.5px solid ${G.border}`,
                    transition: 'all 0.18s ease',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = color;
                    e.currentTarget.style.background  = color + '08';
                    e.currentTarget.style.transform   = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow   = `0 4px 16px ${color}22`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = G.border;
                    e.currentTarget.style.background  = G.white;
                    e.currentTarget.style.transform   = 'none';
                    e.currentTarget.style.boxShadow   = 'none';
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 3 }}>{r}</div>
                    <div style={{ fontSize: 11, color: G.text3, lineHeight: 1.4 }}>{meta.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && search.trim() && (
        <div style={{
          padding: '40px 20px', textAlign: 'center', color: G.text, fontSize: 14,
          background: G.bg2, borderRadius: 8, border: `1px dashed ${G.border}`
        }}>
          <div>Role not in standard list. But we can build a dynamic roadmap for <strong>"{search}"</strong>!</div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onSelect(search.trim())}>
            Generate Roadmap for "{search}"
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline strip used inside the roadmap view ─────────────────────────────────
export function RoleSwitcher({ roles, currentRole, onSelect }) {
  return (
    <div className="card card-md" style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: G.text3,
        marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        Switch roles — {roles.length} available
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {roles.map((r) => {
          const meta   = getRoleMeta(r);
          const active = r === currentRole;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onSelect(r)}
              className="btn btn-sm"
              style={{
                background: active ? meta.catColor : G.white,
                color:      active ? '#fff'         : G.text,
                border:     `1.5px solid ${active ? meta.catColor : G.border}`,
                fontWeight: active ? 700 : 400,
                fontSize:   11,
                display:    'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13 }}>{meta.icon}</span>
              {active ? '✓ ' : ''}{r}
            </button>
          );
        })}
        {/* Custom Role Input */}
        <div style={{ display: 'flex', marginLeft: 'auto', gap: 6 }}>
          <input 
            type="text" 
            placeholder="Custom role..." 
            style={{ padding: '4px 10px', fontSize: 11, border: `1px solid ${G.border}`, borderRadius: 4, outline: 'none' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                onSelect(e.target.value.trim());
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}