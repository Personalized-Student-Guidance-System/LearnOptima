// src/components/career/PhaseCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One phase of the career roadmap timeline.
// CHANGED: "Sem N · 12 weeks" replaced with skill-level progression labels:
//   Beginner → Elementary → Intermediate → Advanced → Expert → Master
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Ic, Spinner } from '../../design/ui';
import { G, ICONS }    from '../../design/tokens';

// ── Skill-level progression (replaces "Sem N") ───────────────────────────────
const SKILL_LEVELS = [
  {
    label:    'Beginner',
    sublabel: 'Start here — foundations & setup',
    icon:     '🌱',
    color:    G.green,
    bg:       G.greenBg,
    border:   G.greenBd,
  },
  {
    label:    'Elementary',
    sublabel: 'Build working knowledge',
    icon:     '📖',
    color:    '#0891b2',
    bg:       '#ecfeff',
    border:   '#a5f3fc',
  },
  {
    label:    'Intermediate',
    sublabel: 'Real-world tools & patterns',
    icon:     '⚙️',
    color:    G.blue,
    bg:       G.blueBg,
    border:   G.blueBd,
  },
  {
    label:    'Advanced',
    sublabel: 'Production-grade expertise',
    icon:     '🔥',
    color:    G.amber,
    bg:       G.amber + '12',
    border:   G.amber + '35',
  },
  {
    label:    'Expert',
    sublabel: 'Capstone projects & portfolio',
    icon:     '🏗️',
    color:    '#7c3aed',
    bg:       '#f5f3ff',
    border:   '#ddd6fe',
  },
  {
    label:    'Master',
    sublabel: 'Interview ready — land the job',
    icon:     '🎯',
    color:    '#dc2626',
    bg:       '#fef2f2',
    border:   '#fecaca',
  },
];

// Tier chip colours for resource rows
const TIER_STYLE = {
  beginner:     { bg: G.greenBg,       color: G.green, label: 'Beginner'     },
  intermediate: { bg: G.blueBg,        color: G.blue,  label: 'Intermediate' },
  advanced:     { bg: G.amber + '15',  color: G.amber, label: 'Advanced'     },
};

// ── Resource chip ─────────────────────────────────────────────────────────────
function ResourceChip({ resource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontSize: 11, color: G.blue,
        textDecoration: 'none',
        padding: '4px 6px', borderRadius: 3,
        background: G.blueBg,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        transition: 'all 0.15s',
        maxWidth: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background     = G.blue + '20';
        e.currentTarget.style.textDecoration = 'underline';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background     = G.blueBg;
        e.currentTarget.style.textDecoration = 'none';
      }}
      title={resource.title}
      onClick={(e) => e.stopPropagation()}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{resource.title}</span>
      <Ic path={ICONS.externalLink} size={8} color={G.blue} sw={2} style={{ flexShrink: 0 }} />
    </a>
  );
}

// ── Single task row ───────────────────────────────────────────────────────────
function TaskRow({ item, phaseKey, resourceData, checked, saving, onToggle }) {
  const key       = `${phaseKey}-${item}`;
  const done      = !!checked[key];
  const resources = resourceData?.resources || [];
  const tier      = resourceData?.tier || 'beginner';
  const tierStyle = TIER_STYLE[tier] || TIER_STYLE.beginner;
  const hasSkill  = resourceData?.hasSkill || false;

  return (
    <div style={{
      borderRadius: 5,
      border: `1px solid ${done ? G.greenBd : G.border}`,
      background: done ? G.greenBg : G.bg,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => onToggle(phaseKey, item)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', cursor: 'pointer',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            border: `1.5px solid ${done ? G.green : G.border2}`,
            background: done ? G.green : G.white,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {done && <Ic path={ICONS.check} size={8} color={G.white} sw={2.5} />}
          </div>

          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: done ? G.green : G.text,
              textDecoration: done ? 'line-through' : 'none',
            }}>
              {item}
            </span>
            {hasSkill && (
              <span style={{ fontSize: 10, color: G.green, marginLeft: 8, fontWeight: 600 }}>
                ✓ You have this
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {saving[key] && <Spinner size={12} />}
          {resources.length > 0 && !saving[key] && (
            <>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px',
                borderRadius: 3, background: tierStyle.bg, color: tierStyle.color,
              }}>
                {tierStyle.label}
              </span>
              <span style={{
                fontSize: 10, color: G.text3,
                padding: '2px 6px', background: G.border2 + '40', borderRadius: 3,
              }}>
                {resources.length} resources
              </span>
            </>
          )}
        </div>
      </div>

      {resources.length > 0 && (
        <div style={{
          padding: '6px 12px',
          borderTop: `1px solid ${G.border}`,
          background: G.bg2,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {resources.map((res, idx) => (
              <ResourceChip key={idx} resource={res} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Phase card ────────────────────────────────────────────────────────────────
export default function PhaseCard({ phase, phaseIndex, checked, saving, onToggle }) {
  const phaseKey   = phase.title || phase.phase || `phase-${phaseIndex}`;
  const level      = SKILL_LEVELS[Math.min(phaseIndex, SKILL_LEVELS.length - 1)];
  const phaseColor = level.color;
  const tasks      = phase.tasks || [];
  const resourcesList = phase.resources || [];
  const phaseDone  = tasks.filter((item) => checked[`${phaseKey}-${item}`]).length;
  const isComplete = phaseDone === tasks.length && tasks.length > 0;

  return (
    <div style={{ position: 'relative', paddingLeft: 52, marginBottom: 16 }}>
      {/* Timeline dot */}
      <div style={{
        position: 'absolute', left: 8, top: 22,
        width: 20, height: 20, borderRadius: '50%', zIndex: 2,
        background: isComplete ? G.green : phaseIndex === 0 ? phaseColor : G.white,
        border: `2px solid ${isComplete ? G.green : phaseColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10,
      }}>
        {isComplete
          ? <Ic path={ICONS.check} size={9} color={G.white} sw={3} />
          : <span>{level.icon}</span>
        }
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {/* ── Phase header ── */}
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${G.border}`,
          background: level.bg,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            {/* Level pill + sublabel — replaces "Sem N · duration" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{
                fontSize: 10, fontWeight: 800,
                padding: '2px 10px', borderRadius: 20,
                background: phaseColor, color: '#fff',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {level.icon} {level.label}
              </span>
              <span style={{ fontSize: 10, color: G.text3 }}>
                {phase.duration || level.sublabel}
              </span>
            </div>

            {/* Phase title */}
            <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>
              {phase.title || phaseKey}
            </div>

            {phase.description && (
              <div style={{ fontSize: 11, color: G.text3, marginTop: 2, maxWidth: 500 }}>
                {phase.description}
              </div>
            )}
          </div>

          {/* Progress badge + mini bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span className="badge" style={{
              background: phaseColor + '18',
              color:      phaseColor,
              border:     `1px solid ${phaseColor}30`,
              fontWeight: 700, fontSize: 11,
            }}>
              {phaseDone}/{tasks.length}
            </span>
            <div style={{ width: 60 }}>
              <div style={{
                height: 3, borderRadius: 999,
                background: level.border,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${tasks.length ? (phaseDone / tasks.length) * 100 : 0}%`,
                  background: phaseColor,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Task list ── */}
        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((item, taskIdx) => (
            <TaskRow
              key={item}
              item={item}
              phaseKey={phaseKey}
              resourceData={resourcesList[taskIdx] || {}}
              checked={checked}
              saving={saving}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton version ──────────────────────────────────────────────────────────
export function SkeletonPhaseCard({ count = 6 }) {
  const shimmer = {
    background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  };
  return (
    <div style={{ position: 'relative', paddingLeft: 52 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{
            position: 'absolute', left: 8, top: 22,
            width: 20, height: 20, borderRadius: '50%',
            background: G.border2, ...shimmer,
          }} />
          <div className="card" style={{ height: 120, ...shimmer }} />
        </div>
      ))}
    </div>
  );
}