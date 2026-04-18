import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API, { startBurnoutCoach, sendBurnoutCoachMessage } from '../services/api';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const sliderDefs = [
  { k: 'studyHours', label: 'Study Hours / Day', max: 14, unit: 'h', goodDir: 'low' },
  { k: 'sleepHours', label: 'Sleep Hours / Night', max: 12, unit: 'h', goodDir: 'high' },
  { k: 'deadlinePressure', label: 'Deadline Pressure', max: 10, unit: '/10', goodDir: 'low' },
  { k: 'academicLoad', label: 'Academic Workload', max: 10, unit: '/10', goodDir: 'low' },
  { k: 'exerciseTime', label: 'Exercise Days / Week', max: 7, unit: 'd', goodDir: 'high' },
  { k: 'socialTime', label: 'Social / Leisure Time', max: 8, unit: 'h', goodDir: 'high' },
];

const riskColor = { Low: G.green, Moderate: G.amber, High: G.red, Critical: G.red };
const riskBg = { Low: G.greenBg, Moderate: G.amberBg, High: G.redBg, Critical: G.redBg };
const riskBd = { Low: G.greenBd, Moderate: G.amberBd, High: G.redBd, Critical: G.redBd };
const readinessTone = {
  'on-track': { color: G.green, bg: G.greenBg, border: G.greenBd, label: 'On track' },
  stretch: { color: G.amber, bg: G.amberBg, border: G.amberBd, label: 'Stretch goal' },
  recalibrate: { color: G.red, bg: G.redBg, border: G.redBd, label: 'Recalibrate' },
  'no-target-role': { color: G.text2, bg: G.bg2, border: G.border, label: 'Profile needed' },
};

const providerTone = {
  gemini: { label: 'Provider: Gemini', color: G.green, bg: G.greenBg, border: G.greenBd },
  fallback: { label: 'Provider: Fallback', color: G.amber, bg: G.amberBg, border: G.amberBd },
  'fallback-unavailable': { label: 'Provider: Fallback only', color: G.amber, bg: G.amberBg, border: G.amberBd },
  unknown: { label: 'Provider: Unknown', color: G.text2, bg: G.bg2, border: G.border },
};

const helperText = {
  studyHours: 'Try to stay within focused, high-quality study blocks rather than long exhausting sessions.',
  sleepHours: 'Sleep is the fastest recovery lever. 7–8 hours is ideal for most students.',
  deadlinePressure: 'High pressure for many days in a row is a strong burnout signal.',
  academicLoad: 'A heavy workload is manageable only when paired with breaks and recovery.',
  exerciseTime: 'Even light exercise a few days a week improves focus and stress recovery.',
  socialTime: 'Short check-ins with friends or family help reduce isolation and mental fatigue.',
};

const quickPresets = [
  {
    label: 'Balanced Week',
    values: { studyHours: 4, sleepHours: 7.5, deadlinePressure: 4, academicLoad: 5, exerciseTime: 3, socialTime: 3 },
  },
  {
    label: 'Exam Crunch',
    values: { studyHours: 9, sleepHours: 5, deadlinePressure: 9, academicLoad: 8, exerciseTime: 1, socialTime: 1 },
  },
  {
    label: 'Recovery Mode',
    values: { studyHours: 3, sleepHours: 8, deadlinePressure: 3, academicLoad: 4, exerciseTime: 4, socialTime: 4 },
  },
];

const suggestions = {
  Low: ['Great balance! Maintain your current routine.', 'Continue regular physical activity.', 'Set long-term goals and celebrate milestones.'],
  Moderate: ['Apply Pomodoro: 45 min study → 15 min break.', 'Target 7–8 hours of sleep each night.', 'Exercise at least 3 days per week.', 'Block one weekend day for complete rest.'],
  High: ['Reduce daily study to a maximum of 4 hours.', 'Maintain a strict 8-hour sleep schedule.', 'Speak with your academic counselor.', 'Avoid all-nighters for the next 3 weeks.'],
  Critical: ['Take an immediate 2-day break.', 'Seek professional mental health support.', 'Prioritize sleep above all else.', 'Contact your university counseling center.'],
};

const getAuthToken = () => localStorage.getItem('sf_token') || localStorage.getItem('token');

export default function BurnoutPredictor() {
  const [vals, setVals] = useState({ studyHours: 4, sleepHours: 7, deadlinePressure: 5, academicLoad: 5, exerciseTime: 3, socialTime: 3 });
  const [result, setResult] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error-local'
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Agentic coach state
  const [coach, setCoach] = useState({ threadId: null, stage: null, messages: [], plan: null, provider: null });
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachSending, setCoachSending] = useState(false);
  const [coachInput, setCoachInput] = useState('');

  const coachProviderTone = providerTone[coach.provider] || providerTone.unknown;

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      API.get('/burnout').then(res => {
        setVals(res.data);
        if (res.data?.source === 'saved') setLastSavedAt(new Date());
        setLoading(false);
      }).catch(() => {
        setTimeout(() => setLoading(false), 1000);
      });
    } else {
      setTimeout(() => setLoading(false), 1000);
    }
  }, []);

  // Start/resume coach thread
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    setCoachLoading(true);
    startBurnoutCoach()
      .then((res) => {
        setCoach({
          threadId: res.data.threadId,
          stage: res.data.stage,
          messages: res.data.messages || [],
          plan: res.data.plan || null,
          provider: res.data.provider || null,
        });
      })
      .catch((e) => {
        console.error('Coach start failed:', e.response?.data || e.message);
      })
      .finally(() => setCoachLoading(false));
  }, []);

  const sendCoachMessage = async () => {
    const token = getAuthToken();
    const msg = coachInput.trim();
    if (!token || !msg) return;

    setCoachSending(true);
    try {
      const res = await sendBurnoutCoachMessage(msg);
      setCoachInput('');
      setCoach((prev) => ({
        ...prev,
        threadId: res.data.threadId,
        stage: res.data.stage,
        messages: res.data.messages || prev.messages,
        plan: res.data.plan || null,
        provider: res.data.provider || prev.provider || 'gemini',
      }));
    } catch (e) {
      console.error('Coach message failed:', {
        status: e.response?.status,
        data: e.response?.data,
        requestUrl: e.config?.url,
        baseURL: e.config?.baseURL,
        message: e.message,
      });
    } finally {
      setCoachSending(false);
    }
  };

  const applyPreset = (values) => {
    setVals(values);
    setSaveStatus('');
  };

  const topWarnings = [
    vals.sleepHours < 6 ? 'Sleep debt is the strongest risk signal right now.' : null,
    vals.studyHours > 8 ? 'Your study load is high enough to need protected breaks.' : null,
    vals.deadlinePressure >= 8 ? 'Deadline pressure is very high — reduce task switching today.' : null,
    vals.exerciseTime < 2 ? 'Low movement can make stress recovery slower.' : null,
    vals.socialTime < 1 ? 'Low social time may increase isolation and exhaustion.' : null,
  ].filter(Boolean).slice(0, 3);

  const predict = async () => {
    setPredicting(true);
    try {
      const res = await API.post('/burnout/predict', vals);
      setResult(res.data);
    } catch (error) {
      console.log('Using fallback calculation');
      let score = 0;
      if (vals.studyHours > 8) score += 25;
      else if (vals.studyHours > 6) score += 15;
      if (vals.sleepHours < 6) score += 25;
      else if (vals.sleepHours < 7) score += 10;
      if (vals.socialTime < 1) score += 15;
      if (vals.exerciseTime < 1) score += 10;
      score += (vals.deadlinePressure / 10) * 15;
      score += (vals.academicLoad / 10) * 10;
      score = Math.min(100, Math.round(score));
      const level = score < 30 ? 'Low' : score < 60 ? 'Moderate' : score < 80 ? 'High' : 'Critical';
      setResult({ score, level, suggestions: suggestions[level] || [] });
    } finally {
      setPredicting(false);
    }
  };

  const saveMetrics = async () => {
    setSaveStatus('saving');
    try {
      const res = await API.post('/burnout/save-metrics', vals);
      if (res.data?.burnoutMetrics) setVals(res.data.burnoutMetrics);
      setLastSavedAt(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      console.error('Save metrics FAILED:', {
        status: e.response?.status,
        data: e.response?.data,
        message: e.message
      });
      setSaveStatus(e.response?.status === 401 ? 'error-auth' : 'error-local');
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  if (loading) {
    return (
      <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Spinner size={24} style={{ marginBottom: 24 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: G.text }}>Loading your study data</div>
          <div style={{ fontSize: 13, color: G.text2 }}>Fetching recent sessions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Burnout Predictor</h1>
        <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Track your current load, save your metrics, and get support with recovery + goal recalibration.</p>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16, background: `linear-gradient(135deg, ${G.bg2}, ${G.panel || G.bg})` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: G.text2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Today’s metrics overview
            </div>
            <div style={{ fontSize: 13, color: G.text2, lineHeight: 1.6 }}>
              Save your current routine, then run prediction to get your real burnout risk, intervention guidance, and goal recalibration advice.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {[
                `Study ${vals.studyHours}h/day`,
                `Sleep ${vals.sleepHours}h/night`,
                `Pressure ${vals.deadlinePressure}/10`,
                `Workload ${vals.academicLoad}/10`,
              ].map((item) => (
                <span
                  key={item}
                  className="badge"
                  style={{
                    background: G.bg,
                    color: G.text,
                    border: `1px solid ${G.border}`,
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {quickPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => applyPreset(preset.values)}
                  style={{ borderRadius: 999 }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {lastSavedAt && (
              <div style={{ fontSize: 11, color: G.text2 }}>
                Last saved: {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <div style={{ fontSize: 11, color: G.text2, lineHeight: 1.5 }}>
              This section is only a summary of the values you entered — the actual burnout result appears after you click <strong>Run Prediction</strong>.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Sliders */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700 }}>
            Daily Metrics
          </div>
          <div style={{ padding: 20 }}>
            {sliderDefs.map(({ k, label, max, unit, goodDir }) => {
              const good = goodDir === 'high' ? vals[k] >= 5 : vals[k] <= 5;
              const pct = (vals[k] / max) * 100;
              return (
                <div key={k} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: G.text, margin: 0 }}>{label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{vals[k]}{unit}</span>
                      <div className="dot" style={{ 
                        width: 8, height: 8, borderRadius: '50%', 
                        backgroundColor: good ? G.green : G.red 
                      }} />
                    </div>
                  </div>
                  <div style={{ 
                    position: 'relative', height: 4, borderRadius: 99, 
                    backgroundColor: G.bg2, overflow: 'hidden', marginBottom: 8 
                  }}>
                    <div style={{ 
                      position: 'absolute', left: 0, top: 0, height: '100%', 
                      borderRadius: 99, backgroundColor: good ? G.green : G.red, 
                      width: `${pct}%`, transition: 'width 0.2s ease' 
                    }} />
                  </div>
                  <input 
                    type="range" 
                    min={0} 
                    max={max} 
                    value={vals[k]} 
                    onChange={(e) => setVals(prev => ({ ...prev, [k]: Number(e.target.value) }))} 
                    style={{ width: '100%', height: 6, cursor: 'pointer' }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: G.text3, marginTop: 4 }}>
                    <span>0</span><span>{max}{unit}</span>
                  </div>
                  <div style={{ fontSize: 11, color: G.text2, marginTop: 6, lineHeight: 1.5 }}>
                    {helperText[k]}
                  </div>
                </div>
              );
            })}
            <>
                  {topWarnings.length > 0 && (
                    <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: `1px solid ${G.amberBd}`, background: G.amberBg }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 6 }}>What needs attention first</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: G.text, lineHeight: 1.6 }}>
                        {topWarnings.map((item, idx) => <li key={idx}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                  <button 
                    className="btn btn-secondary" 
                    onClick={saveMetrics}
                    disabled={saveStatus === 'saving'}
                    style={{ width: '100%', marginBottom: 12 }}
                  >
                    {saveStatus === 'saving' ? 'Saving...' : 'Save My Metrics'}
                  </button>
                  {saveStatus && (
                    <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, textAlign: 'center', marginBottom: 12, backgroundColor: saveStatus === 'saved' ? '#dcfce7' : '#fef2f2', color: saveStatus === 'saved' ? '#166534' : '#dc2626', border: `1px solid ${saveStatus === 'saved' ? '#bbf7d0' : '#fecaca'}` }}>
                      {saveStatus === 'saved' ? '✅ Metrics saved to profile!' : 
                       saveStatus === 'error-auth' ? '⚠️ Your session expired. Please log in again and retry.' :
                       saveStatus === 'error-local' ? '⚠️ Save failed. Please check your login/session and backend connection.' : ''}
                    </div>
                  )}
                  <button 
                    className="btn btn-primary" 
                    onClick={predict} 
                    disabled={predicting}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {predicting ? (
                      <>
                        <Spinner size={16} /> Analyzing…
                      </>
                    ) : (
                      'Run Prediction'
                    )}
                  </button>
                </>
          </div>
        </div>

        {/* Results + Coach */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Agentic coach */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700 }}>
              AI Burnout Coach (Gemini)
            </div>

            <div style={{ padding: '8px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: G.bg2 }}>
              <div style={{ fontSize: 11, color: G.text2 }}>
                {coach.provider === 'gemini'
                  ? 'Connected to Gemini agent'
                  : coach.provider === 'fallback'
                    ? 'Gemini failed — fallback coach is active'
                    : coach.provider === 'fallback-unavailable'
                      ? 'Gemini not configured — fallback mode only'
                      : 'Checking Gemini connection…'}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: coachSending ? G.blue : (coach.provider === 'gemini' ? G.green : G.text2) }}>
                {coachSending ? 'Coach is thinking…' : (coach.provider === 'gemini' ? 'LIVE AI' : 'READY')}
              </span>
            </div>

            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                background: coachProviderTone.bg,
                border: `1px solid ${coachProviderTone.border}`,
                color: coachProviderTone.color,
                fontSize: 11,
                fontWeight: 700,
              }}>
                {coachProviderTone.label}
              </span>
              <span style={{ fontSize: 11, color: G.text2 }}>
                {coach.provider === 'fallback' || coach.provider === 'fallback-unavailable'
                  ? 'Gemini may be unavailable, rate-limited, or misconfigured.'
                  : 'Gemini responses are live when available.'}
              </span>
            </div>

            {coachLoading ? (
              <div style={{ padding: 16, fontSize: 12, color: G.text2, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Spinner size={14} /> Loading coach and connecting to Gemini…
              </div>
            ) : (
              <>
                <div style={{ padding: 16, maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(coach.messages || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: G.text2 }}>
                      Start by sending a message about how you feel today.
                    </div>
                  ) : (
                    coach.messages.map((m, idx) => (
                      <div key={idx} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '90%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: m.role === 'user' ? (G.blue + '15') : G.bg2,
                        border: `1px solid ${G.border}`,
                        fontSize: 12,
                        color: G.text,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {m.content}
                      </div>
                    ))
                  )}
                </div>

                <div style={{ padding: 12, borderTop: `1px solid ${G.border}`, display: 'flex', gap: 8 }}>
                  <input
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    placeholder="Type your answer…"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${G.border}`, fontSize: 12 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendCoachMessage(); }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={sendCoachMessage}
                    disabled={coachSending}
                  >
                    {coachSending ? 'Sending…' : 'Send'}
                  </button>
                </div>

                {coachSending && (
                  <div style={{ padding: '0 12px 12px 12px', fontSize: 12, color: G.blue, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Spinner size={14} /> Gemini is generating your next response and plan…
                  </div>
                )}

                {coach.plan && (
                  <div style={{ padding: 16, borderTop: `1px solid ${G.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Your 7‑day plan</div>
                    <div style={{ fontSize: 12, color: G.text2, marginBottom: 10 }}>{coach.plan.summary}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(coach.plan.dailyPlan || []).map((d, i) => (
                        <div key={i} style={{ border: `1px solid ${G.border}`, borderRadius: 8, padding: 12, background: G.bg2 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{d.day} — {d.focus}</div>
                          <ul style={{ margin: '6px 0 0 18px', fontSize: 12, color: G.text }}>
                            {(d.actions || []).map((a, ai) => <li key={ai}>{a}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                    {Array.isArray(coach.plan.redFlags) && coach.plan.redFlags.length > 0 && (
                      <div style={{ marginTop: 12, fontSize: 12, color: G.red }}>
                        <strong>Red flags:</strong> {coach.plan.redFlags.join(' · ')}
                      </div>
                    )}
                    {coach.plan.checkIn && (
                      <div style={{ marginTop: 10, fontSize: 12, color: G.text2 }}>
                        <strong>Check‑in:</strong> {coach.plan.checkIn}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {result ? (
            <>
              <div className="card card-lg" style={{
                backgroundColor: riskBg[result.level],
                border: `1px solid ${riskBd[result.level]}`,
                textAlign: 'center',
                padding: '24px 20px'
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: riskColor[result.level], textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Burnout Risk Level
                </div>
                <div style={{ fontWeight: 800, fontSize: 42, color: riskColor[result.level], letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12 }}>
                  {result.level}
                </div>
                <div className="progress-track" style={{ height: 8, backgroundColor: G.bg2, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div className="progress-bar" style={{ 
                    height: '100%', width: `${result.score}%`, 
                    backgroundColor: riskColor[result.level], transition: 'width 0.4s ease' 
                  }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: riskColor[result.level] }}>
                  Score: {result.score}/100
                </div>
              </div>

              <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700 }}>
                  Key Factors
                </div>
                {[
                  { label: 'Sleep', val: vals.sleepHours, good: vals.sleepHours >= 7, note: vals.sleepHours < 6 ? 'Critical: Under 6h increases risk 3x' : 'Healthy range' },
                  { label: 'Study Load', val: vals.studyHours, good: vals.studyHours <= 6, note: vals.studyHours > 8 ? 'High load needs breaks' : 'Balanced' },
                  { label: 'Stress', val: vals.deadlinePressure, good: vals.deadlinePressure <= 5, note: vals.deadlinePressure > 7 ? 'High - prioritize stress relief' : 'Manageable' },
                  { label: 'Exercise', val: vals.exerciseTime, good: vals.exerciseTime >= 3, note: vals.exerciseTime < 2 ? 'Low activity = higher vulnerability' : 'Good level' }
                ].map(({ label, good, note }, i) => (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: i < 3 ? `1px solid ${G.border}` : 'none', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="dot" style={{ backgroundColor: good ? G.green : G.red }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{label}</div>
                      <div style={{ fontSize: 12, color: G.text2 }}>{note}</div>
                    </div>
                    <span className="badge" style={{
                      backgroundColor: good ? G.greenBg : G.redBg,
                      color: good ? G.green : G.red,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      {good ? 'Good' : 'Risk'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${G.border}` }}>
                  Actionable Recommendations {result.source === 'ML' && '(ML-powered)'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {result.suggestions?.map((suggestion, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ 
                        fontWeight: 800, color: G.text2, 
                        backgroundColor: G.bg2, width: 28, height: 28, 
                        borderRadius: '50%', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', flexShrink: 0, fontSize: 12 
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: G.text }}>{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>

              {result.coach && (
                <div className="card">
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700 }}>
                    Wellness & Accountability Coach
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: riskColor[result.level],
                      marginBottom: 14,
                    }}>
                      {result.coach.headline}
                    </div>

                    {!!result.coach.interventions?.length && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 10 }}>
                          Immediate interventions
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {result.coach.interventions.map((item, idx) => (
                            <div key={idx} style={{
                              border: `1px solid ${G.border}`,
                              borderRadius: 10,
                              padding: 12,
                              background: G.bg2,
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: G.text }}>{item.title}</div>
                                <span className="badge" style={{
                                  backgroundColor: item.priority === 'high' ? G.redBg : G.amberBg,
                                  color: item.priority === 'high' ? G.red : G.amber,
                                  borderRadius: 999,
                                  padding: '4px 8px',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase'
                                }}>
                                  {item.priority}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: G.text, lineHeight: 1.5, marginBottom: 8 }}>{item.action}</div>
                              <div style={{ fontSize: 11, color: G.text2 }}>Suggested window: {item.duration}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, border: `1px dashed ${riskBd[result.level]}`, background: riskBg[result.level] }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 6 }}>Coach action for today</div>
                      <div style={{ fontSize: 12, color: G.text, lineHeight: 1.6 }}>
                        {result.level === 'Critical'
                          ? 'Pause non-urgent work, recover first, and tell one trusted person that you are scaling back today.'
                          : result.level === 'High'
                            ? 'Protect your next break now and reduce your plan to only the most important tasks.'
                            : result.level === 'Moderate'
                              ? 'Use one focused study block followed by a real break and an evening recovery habit.'
                              : 'Maintain your routine and keep one recovery habit scheduled so your balance stays stable.'}
                      </div>
                    </div>

                    {!!result.coach.accountabilityPrompts?.length && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 10 }}>
                          Accountability prompts
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {result.coach.accountabilityPrompts.map((prompt, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ width: 20, height: 20, borderRadius: '50%', background: G.bg2, color: G.text2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                {idx + 1}
                              </span>
                              <span style={{ fontSize: 12, color: G.text, lineHeight: 1.5 }}>{prompt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result.readiness && (
                <div className="card">
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 700 }}>
                    Goal Recalibration Mentor
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: (readinessTone[result.readiness.status] || readinessTone['no-target-role']).bg,
                      border: `1px solid ${(readinessTone[result.readiness.status] || readinessTone['no-target-role']).border}`,
                      color: (readinessTone[result.readiness.status] || readinessTone['no-target-role']).color,
                      fontSize: 11,
                      fontWeight: 700,
                      marginBottom: 12,
                    }}>
                      {(readinessTone[result.readiness.status] || readinessTone['no-target-role']).label}
                      {typeof result.readiness.readinessScore === 'number' && result.readiness.currentRole ? ` · ${result.readiness.readinessScore}% readiness` : ''}
                    </div>

                    <div style={{ fontSize: 13, color: G.text, lineHeight: 1.6, marginBottom: 12 }}>
                      {result.readiness.message}
                    </div>

                    {result.readiness.status === 'recalibrate' && (
                      <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, border: `1px solid ${G.amberBd}`, background: G.amberBg, fontSize: 12, color: G.text, lineHeight: 1.6 }}>
                        Your target is still possible — the coach is simply recommending a more confidence-building step before jumping straight to the final role.
                      </div>
                    )}

                    {result.readiness.currentRole && (
                      <div style={{ fontSize: 12, color: G.text2, marginBottom: 12 }}>
                        Current target: <strong style={{ color: G.text }}>{result.readiness.currentRole}</strong>
                      </div>
                    )}

                    {!!result.readiness.missingSkills?.length && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 8 }}>
                          Top missing skills
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {result.readiness.missingSkills.slice(0, 6).map((skill, idx) => (
                            <span key={idx} className="badge" style={{
                              background: G.bg2,
                              color: G.text,
                              border: `1px solid ${G.border}`,
                              borderRadius: 999,
                              padding: '6px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                            }}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!!result.readiness.suggestedRoles?.length && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 10 }}>
                          Suggested intermediate roles
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {result.readiness.suggestedRoles.map((role, idx) => (
                            <div key={idx} style={{
                              border: `1px solid ${G.border}`,
                              borderRadius: 10,
                              padding: 12,
                              background: G.bg2,
                            }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: G.text, marginBottom: 6 }}>{role.role}</div>
                              <div style={{ fontSize: 12, color: G.text, lineHeight: 1.5, marginBottom: 8 }}>{role.reason}</div>
                              <div style={{ fontSize: 11, color: G.text2 }}>
                                <strong>Next step:</strong> {role.nextStep}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 40px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: G.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Ic path={ICONS.brain} size={28} color={G.text2} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: G.text, marginBottom: 8 }}>Ready to assess burnout risk</div>
              <div style={{ fontSize: 13, color: G.text2, maxWidth: 280 }}>
                Adjust your daily metrics using the sliders, then click "Run Prediction" to get your personalized burnout score and recommendations.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}













