import React from 'react';
import Stepper from './Stepper';
import { G } from '../design/tokens';

const bg = (G && G.bg) || '#f7f7f5';

export default function OnboardingLayout({ step, title, subtitle, children }) {
  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Stepper currentStep={step} />
        {title && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: G.text, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 13, color: G.text2 }}>{subtitle}</p>
            )}
          </div>
        )}
        <div className="card card-lg" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
