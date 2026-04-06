// src/components/career/LiveJobsDropdown.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Collapsible panel that shows live job listings for the selected role.
// Collapsed by default so it doesn't dominate the page.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Ic, Spinner } from '../../design/ui';
import { G, ICONS }     from '../../design/tokens';

// ── Deadline helpers ──────────────────────────────────────────────────────────
function getDaysLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
}

function getDeadlineBadge(daysLeft) {
  if (daysLeft === null) return null;
  if (daysLeft <= 0) return { label: 'Closes today', bg: G.red   + '18', color: G.red,   border: G.red   + '40' };
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, bg: G.amber + '18', color: G.amber, border: G.amber + '40' };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, bg: G.amber + '10', color: G.amber, border: G.amber + '30' };
  return                   { label: `${daysLeft}d left`, bg: G.greenBg,       color: G.green, border: G.greenBd };
}

function formatDeadline(deadline) {
  if (!deadline) return null;
  return new Date(deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Sub-component: single job row ─────────────────────────────────────────────
function JobRow({ job }) {
  const daysLeft = getDaysLeft(job.deadline);
  const badge    = getDeadlineBadge(daysLeft);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: G.white,
        border: `1px solid ${daysLeft !== null && daysLeft <= 3 ? G.amber + '60' : G.blueBd}`,
        borderRadius: 8,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Source icon */}
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: job.source === 'linkedin' ? '#0a66c210' : '#FF6B0010',
        border:     `1px solid ${job.source === 'linkedin' ? '#0a66c230' : '#FF6B0030'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
      }}>
        {job.source === 'linkedin' ? '💼' : '🔍'}
      </div>

      {/* Title + company */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: G.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {job.title}
        </div>
        <div style={{ fontSize: 11, color: G.text3, marginTop: 1 }}>
          {job.company}{job.location ? ` · ${job.location}` : ''}
        </div>
      </div>

      {/* Deadline badge */}
      {job.deadline && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: G.text3, marginBottom: 2 }}>
            Closes {formatDeadline(job.deadline)}
          </div>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 20,
              background: badge.bg, color: badge.color,
              border: `1px solid ${badge.border}`,
            }}>
              {badge.label}
            </span>
          )}
        </div>
      )}

      {/* Apply button */}
      <a
        href={job.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-sm"
        style={{ flexShrink: 0, textDecoration: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        Apply →
      </a>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LiveJobsDropdown({ role, jobs, loading }) {
  const [open, setOpen] = useState(false);

  // Sort by deadline ascending (soonest first)
  const sorted = [...jobs].sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline) : new Date('9999-12-31');
    const db = b.deadline ? new Date(b.deadline) : new Date('9999-12-31');
    return da - db;
  });

  return (
    <div
      className="card card-md"
      style={{
        marginBottom: 20,
        borderLeft: `4px solid ${G.blue}`,
        background: G.blueBg,
        overflow: 'hidden',
      }}
    >
      {/* ── Clickable header ── */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? `1px solid ${G.blueBd}` : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading ? (
            <Spinner size={14} />
          ) : (
            <span style={{ fontSize: 16 }}>💼</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: G.blue }}>
            {loading ? `Fetching live ${role} jobs…` : 'Live Job Openings'}
          </span>
          {!loading && jobs.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20,
              background: G.blue + '18', color: G.blue,
            }}>
              {jobs.length} found
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: G.text3 }}>Naukri · LinkedIn</span>
          {/* Chevron */}
          <span style={{
            fontSize: 12, color: G.blue, fontWeight: 700,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}>
            ▾
          </span>
        </div>
      </div>

      {/* ── Collapsible body ── */}
      {open && (
        <>
          {loading ? (
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  height: 62, borderRadius: 8,
                  border: `1px solid ${G.blueBd}`,
                  background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }} />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: '20px 18px', textAlign: 'center', fontSize: 13, color: G.text3 }}>
              No live jobs found for <strong>{role}</strong> right now.
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 18px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sorted.map((job, idx) => <JobRow key={idx} job={job} />)}
              </div>
              <div style={{
                padding: '8px 18px 12px', fontSize: 11, color: G.text3,
                borderTop: `1px solid ${G.blueBd}`,
              }}>
                💡 Jobs are scraped live for <strong>{role}</strong>. Deadlines are estimated from listing date. ⬆ sorted by closing date.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}