import React from 'react';
import { G } from '../design/tokens';

const STEPS = [
  { num: 1, label: 'Profile' },
  { num: 2, label: 'Resume' },
  { num: 3, label: 'Skills' },
  { num: 4, label: 'Syllabus' },
  { num: 5, label: 'Timetable' },
];

export default function Stepper({ currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 24, flexWrap: 'wrap' }}>
      {STEPS.map(({ num, label }, i) => {
        const active = num === currentStep;
        const done = num < currentStep;
        return (
          <React.Fragment key={num}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: done ? G.green : active ? G.blue : G.bg2,
                  color: done || active ? G.white : G.text3,
                  border: `2px solid ${done ? G.green : active ? G.blue : G.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {done ? '✓' : num}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  color: active ? G.text : G.text2,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: 16,
                  height: 2,
                  background: done ? G.green : G.border,
                  marginLeft: 3,
                  marginRight: 3,
                  marginTop: 10,
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
