// src/components/career/SkillGapBanner.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Displays the ML skill-gap analysis result from /career/personalized.
// Shows: match score, matched skills, high-priority gaps, key insight,
//        estimated weeks to job-ready, and learning order.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';

export default function SkillGapBanner({ skillGap, role }) {
  const [expanded, setExpanded] = useState(false);

  if (!skillGap) return null;

  const {
    matchScore      = 0,
    matchedSkills   = [],
    missingSkills   = [],
    highPriority    = [],
    mediumPriority  = [],
    estimatedWeeks  = 0,
    keyInsight      = '',
    learningOrder   = [],
  } = skillGap;

  // Colour ramp based on match score
  const scoreColor  = matchScore >= 70 ? '#16a34a' : matchScore >= 40 ? '#d97706' : '#dc2626';
  const scoreBg     = matchScore >= 70 ? '#f0fdf4'  : matchScore >= 40 ? '#fffbeb'  : '#fef2f2';
  const scoreBorder = matchScore >= 70 ? '#bbf7d0'  : matchScore >= 40 ? '#fde68a'  : '#fecaca';

  return (
    <div style={{
      marginBottom: 20,
      border: `1px solid ${scoreBorder}`,
      borderLeft: `4px solid ${scoreColor}`,
      borderRadius: 8,
      background: scoreBg,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          padding: '12px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Score circle */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: scoreColor, color: '#fff',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{Math.round(matchScore)}%</span>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor }}>
              Skill Match — {matchScore >= 70 ? 'Strong fit' : matchScore >= 40 ? 'Moderate fit' : 'Needs work'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
              {matchedSkills.length} skills matched · {missingSkills.length} gaps · {estimatedWeeks}w to job-ready
            </div>
          </div>
        </div>

        <span style={{
          fontSize: 12, color: scoreColor, fontWeight: 700,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s', display: 'inline-block',
        }}>▾</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${scoreBorder}` }}>

          {/* Key insight */}
          {keyInsight && (
            <div style={{
              margin: '12px 0 10px',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.6)',
              borderRadius: 6,
              fontSize: 12, color: '#374151', fontStyle: 'italic',
            }}>
              💡 {keyInsight}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>

            {/* Matched skills */}
            {matchedSkills.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✓ You already have ({matchedSkills.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {matchedSkills.map(s => (
                    <span key={s} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0',
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* High-priority gaps */}
            {highPriority.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🔥 Critical gaps ({highPriority.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {highPriority.map(s => (
                    <span key={s} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Medium priority */}
            {mediumPriority.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚡ Good to have ({mediumPriority.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {mediumPriority.map(s => (
                    <span key={s} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a',
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended learning order */}
            {learningOrder.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📚 Learn in this order
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {learningOrder.slice(0, 6).map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#dbeafe', color: '#1d4ed8',
                        fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 11, color: '#374151' }}>{s}</span>
                    </div>
                  ))}
                  {learningOrder.length > 6 && (
                    <span style={{ fontSize: 10, color: '#6b7280' }}>+{learningOrder.length - 6} more…</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Estimated weeks bar */}
          {estimatedWeeks > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                Estimated time to job-ready: <strong style={{ color: '#111827' }}>{estimatedWeeks} weeks</strong>
              </div>
              <div style={{ height: 4, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${Math.min(100, (matchScore))}%`,
                  background: scoreColor, transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}