// src/components/career/ProgressBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Overall progress bar shown at the top of the roadmap view.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { G } from '../../design/tokens';

export default function ProgressBar({ doneCount, totalCount }) {
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="card card-md" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: G.text2 }}>Overall Progress</span>
            <span className="mono" style={{ fontSize: 12, color: G.text }}>
              {doneCount}/{totalCount} completed
            </span>
          </div>
          <div className="progress-track" style={{ height: 6 }}>
            <div className="progress-bar" style={{ width: `${pct}%`, background: G.green }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: G.green }}>{pct}%</div>
          <div style={{ fontSize: 11, color: G.text3 }}>complete</div>
        </div>
      </div>
    </div>
  );
}