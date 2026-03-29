import React from 'react';
import { G } from '../design/tokens';

const STEPS = [
  { num: 1, label: 'Profile & Goals' },
  { num: 2, label: 'Upload Resume' },
  { num: 3, label: 'Extra Skills' },
  { num: 4, label: 'Upload Syllabus' },
  { num: 5, label: 'Upload Timetable' },
];

export default function Stepper({ currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 32, flexWrap: 'wrap' }}>
      {STEPS.map(({ num, label }, i) => {
        const active = num === currentStep;
        const done = num < currentStep;
        return (
          <React.Fragment key={num}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: done ? G.green : active ? G.blue : G.bg2,
                  color: done || active ? G.white : G.text3,
                  border: `2px solid ${done ? G.green : active ? G.blue : G.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {done ? '✓' : num}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? G.text : G.text2,
                }}
              >
                Step {num} — {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background: done ? G.green : G.border,
                  marginLeft: 4,
                  marginRight: 4,
                  marginTop: 13,
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
