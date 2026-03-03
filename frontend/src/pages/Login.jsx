import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

export default function Login() {
  const [email,    setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: G.bg }}>
      {/* Left branding panel */}
      <div style={{ width: 420, background: G.white, borderRight: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', padding: '48px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="white"><path d="M6 1L10.5 4V8L6 11L1.5 8V4L6 1Z"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: G.text }}>StudentFriend</span>
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontWeight: 800, fontSize: 28, color: G.text, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12 }}>
            Your AI-powered academic assistant
          </h1>
          <p style={{ fontSize: 13, color: G.text2, lineHeight: 1.7, marginBottom: 40 }}>
            Plan smarter, close skill gaps, track goals, and prevent burnout — all in one platform built for students.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: 'calendar', title: 'Smart Planner',      desc: 'AI-generated daily, weekly & monthly study plans' },
              { icon: 'zap',      title: 'Skill Gap Analyzer', desc: 'Know exactly what to learn for your target role' },
              { icon: 'brain',    title: 'Burnout Predictor',  desc: 'ML-based detection before burnout hits' },
              { icon: 'map',      title: 'Career Roadmap',     desc: 'Semester-by-semester roadmap to your goal' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: G.bg, border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Ic path={ICONS[icon]} size={13} color={G.text2} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{title}</div>
                  <div style={{ fontSize: 12, color: G.text3, marginTop: 1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: G.text3, marginTop: 40 }}>© 2026 StudentFriend · Made for students</div>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 360, animation: 'fadeSlideUp 0.4s ease both' }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: G.text, letterSpacing: '-0.02em' }}>Sign in</h2>
            <p style={{ fontSize: 13, color: G.text2, marginTop: 4 }}>Enter your credentials to continue</p>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 16, fontSize: 13, color: G.red }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Email address</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@student.edu" required />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="field-label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 14 }}>
              {loading ? <><Spinner /> Signing in…</> : 'Sign in →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: G.text3 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: G.blue, fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
          </div>

          <div style={{ marginTop: 40, padding: 14, borderRadius: 7, background: G.bg2, border: `1px solid ${G.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: G.text2, marginBottom: 4 }}>Demo credentials</div>
            <div className="mono" style={{ fontSize: 11, color: G.text3 }}>arjun@student.edu / password123</div>
          </div>
        </div>
      </div>
    </div>
  );
}