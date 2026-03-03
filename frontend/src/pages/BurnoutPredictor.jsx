import React, { useState } from 'react';
import axios from 'axios';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const sliderDefs = [
  { k: 'studyHours',       label: 'Study Hours / Day',       max: 14, unit: 'h',  goodDir: 'low' },
  { k: 'sleepHours',       label: 'Sleep Hours / Night',      max: 12, unit: 'h',  goodDir: 'high' },
  { k: 'deadlinePressure', label: 'Deadline Pressure',        max: 10, unit: '/10',goodDir: 'low' },
  { k: 'academicLoad',     label: 'Academic Workload',        max: 10, unit: '/10',goodDir: 'low' },
  { k: 'exerciseTime',     label: 'Exercise Days / Week',     max: 7,  unit: 'd',  goodDir: 'high' },
  { k: 'socialTime',       label: 'Social / Leisure Time',    max: 8,  unit: 'h',  goodDir: 'high' },
];

const riskColor = { Low: G.green, Moderate: G.amber, High: G.red,    Critical: G.red };
const riskBg    = { Low: G.greenBg,Medium: G.amberBg,High: G.redBg,   Critical: G.redBg };
const riskBd    = { Low: G.greenBd,Medium: G.amberBd, High: G.redBd,  Critical: G.redBd };

const suggestions = {
  Low:      ['Great balance! Maintain your current routine.','Continue regular physical activity.','Set long-term goals and celebrate milestones.'],
  Moderate: ['Apply Pomodoro: 45 min study → 15 min break.','Target 7–8 hours of sleep each night.','Exercise at least 3 days per week.','Block one weekend day for complete rest.'],
  High:     ['Reduce daily study to a maximum of 4 hours.','Maintain a strict 8-hour sleep schedule.','Speak with your academic counselor.','Avoid all-nighters for the next 3 weeks.'],
  Critical: ['Take an immediate 2-day break.','Seek professional mental health support.','Prioritize sleep above all else.','Contact your university counseling center.'],
};

export default function BurnoutPredictor() {
  const [vals,       setVals]       = useState({ studyHours: 8, sleepHours: 6, deadlinePressure: 7, academicLoad: 6, exerciseTime: 2, socialTime: 2 });
  const [result,     setResult]     = useState(null);
  const [predicting, setPredicting] = useState(false);

  const predict = async () => {
    setPredicting(true);
    try {
      const res = await axios.post('/burnout/predict', vals);
      setResult(res.data);
    } catch {
      // Fallback calculation
      let score = 0;
      if (vals.studyHours > 8) score += 25; else if (vals.studyHours > 6) score += 15;
      if (vals.sleepHours < 6) score += 25; else if (vals.sleepHours < 7) score += 10;
      if (vals.socialTime < 1) score += 15;
      if (vals.exerciseTime < 1) score += 10;
      score += (vals.deadlinePressure / 10) * 15;
      score += (vals.academicLoad / 10) * 10;
      score = Math.min(100, Math.round(score));
      const level = score < 30 ? 'Low' : score < 60 ? 'Moderate' : score < 80 ? 'High' : 'Critical';
      setResult({ score, level });
    } finally { setPredicting(false); }
  };

  const isGood = ({ k, goodDir }) => goodDir === 'high' ? vals[k] >= 5 : vals[k] <= 5;

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Burnout Predictor</h1>
        <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>ML-based burnout risk assessment from lifestyle inputs</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Sliders */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700 }}>Daily Metrics</div>
          <div style={{ padding: 20 }}>
            {sliderDefs.map(({ k, label, max, unit, goodDir }) => {
              const good = goodDir === 'high' ? vals[k] >= 5 : vals[k] <= 5;
              const pct  = (vals[k] / max) * 100;
              return (
                <div key={k} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>{label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{vals[k]}{unit}</span>
                      <div className="dot" style={{ background: good ? G.green : G.red }} />
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 4, borderRadius: 99, background: G.bg2, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 99, background: good ? G.green : G.red, width: `${pct}%`, transition: 'width 0.2s' }} />
                  </div>
                  <input type="range" min={0} max={max} value={vals[k]} onChange={e => setVals(v => ({ ...v, [k]: +e.target.value }))} style={{ width: '100%', accentColor: good ? G.green : G.red, cursor: 'pointer', height: 0, opacity: 0, position: 'relative', top: -8 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: G.text3 }}>
                    <span>0</span><span>{max}{unit}</span>
                  </div>
                </div>
              );
            })}
            <button className="btn btn-primary" onClick={predict} disabled={predicting} style={{ width: '100%', justifyContent: 'center' }}>
              {predicting ? <><Spinner /> Analyzing…</> : 'Run Prediction'}
            </button>
          </div>
        </div>

        {/* Result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!result ? (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: G.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ic path={ICONS.brain} size={22} color={G.text3} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: G.text, marginBottom: 6 }}>No prediction yet</div>
              <div style={{ fontSize: 12, color: G.text3, maxWidth: 220 }}>Adjust the sliders to reflect your routine, then run the prediction.</div>
            </div>
          ) : (
            <>
              <div className="card card-lg" style={{ background: riskBg[result.level], border: `1px solid ${riskBd[result.level]}`, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: riskColor[result.level], textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Burnout Risk Level</div>
                <div style={{ fontWeight: 800, fontSize: 42, color: riskColor[result.level], letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8 }}>{result.level}</div>
                <div className="progress-track" style={{ maxWidth: 180, margin: '0 auto 8px' }}>
                  <div className="progress-bar" style={{ width: `${result.score}%`, background: riskColor[result.level] }} />
                </div>
                <div className="mono" style={{ fontSize: 11, color: riskColor[result.level] }}>Score: {result.score} / 100</div>
              </div>

              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700 }}>Factor Analysis</div>
                {[
                  { label: 'Sleep Quality',     status: vals.sleepHours >= 7 ? 'good' : 'risk',     note: vals.sleepHours < 6 ? 'Under 6 hours significantly increases risk' : vals.sleepHours < 7 ? 'Slightly below recommended' : 'Healthy sleep range' },
                  { label: 'Study Load',         status: vals.studyHours <= 6 ? 'good' : 'risk',     note: vals.studyHours > 8 ? 'High study hours — schedule mandatory breaks' : 'Manageable load' },
                  { label: 'Stress Level',       status: vals.deadlinePressure <= 5 ? 'good' : 'risk', note: vals.deadlinePressure > 7 ? 'High pressure — needs active management' : 'Moderate stress level' },
                  { label: 'Physical Activity', status: vals.exerciseTime >= 3 ? 'good' : 'risk',    note: vals.exerciseTime < 2 ? 'Low activity increases burnout vulnerability' : 'Good activity level' },
                ].map(({ label, status, note }) => (
                  <div key={label} style={{ padding: '10px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div className="dot" style={{ background: status === 'good' ? G.green : G.red, marginTop: 4 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: G.text }}>{label}</div>
                      <div style={{ fontSize: 11, color: G.text2, marginTop: 2 }}>{note}</div>
                    </div>
                    <span className="badge" style={{ background: status === 'good' ? G.greenBg : G.redBg, color: status === 'good' ? G.green : G.red, border: `1px solid ${status === 'good' ? G.greenBd : G.redBd}` }}>
                      {status === 'good' ? 'OK' : 'Risk'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="card card-md">
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Recommendations</div>
                {(suggestions[result.level] || []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 9, paddingBottom: 9, borderBottom: i < suggestions[result.level].length - 1 ? `1px solid ${G.border}` : 'none' }}>
                    <span className="mono" style={{ fontSize: 11, color: G.text3, flexShrink: 0, marginTop: 1 }}>0{i + 1}</span>
                    <span style={{ fontSize: 12, color: G.text2, lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}