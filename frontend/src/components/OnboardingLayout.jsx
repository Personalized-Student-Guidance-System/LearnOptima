import React from 'react';
import Stepper from './Stepper';
import { G } from '../design/tokens';

const bg = (G && G.bg) || '#f7f7f5';

export default function OnboardingLayout({ step, title, subtitle, children }) {
  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '28px 20px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Stepper currentStep={step} />
        {title && (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: G.text, letterSpacing: '-0.02em', marginBottom: 3 }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 12, color: G.text2 }}>
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className="card card-lg" style={{ animation: 'fadeSlideUp 0.3s ease both', padding: '20px 18px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
