import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOnboardingRedirect } from '../utils/onboardingRedirect';
import { Spinner } from '../design/ui';
import { G } from '../design/tokens';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await signup(form.name, form.email, form.password);
      navigate(getOnboardingRedirect(user));
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: G.bg }}>
      <div style={{ width: 420, background: G.white, borderRight: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', padding: 48, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="white"><path d="M6 1L10.5 4V8L6 11L1.5 8V4L6 1Z"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: G.text }}>LearnOptima</span>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontWeight: 800, fontSize: 28, color: G.text, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12 }}>
            Start your study journey
          </h1>
          <p style={{ fontSize: 13, color: G.text2, lineHeight: 1.7 }}>
            Create an account and we'll guide you through a quick setup so we can personalize your roadmap and plans.
          </p>
        </div>
        <div style={{ fontSize: 11, color: G.text3, marginTop: 40 }}>© 2026 LearnOptima</div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 360, animation: 'fadeSlideUp 0.4s ease both' }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: G.text, letterSpacing: '-0.02em' }}>Create account</h2>
            <p style={{ fontSize: 13, color: G.text2, marginTop: 4 }}>We'll collect more details in the next steps</p>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 16, fontSize: 13, color: G.red }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Full name</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Arjun Sharma" required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@student.edu" required />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="field-label">Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required minLength={8} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 14 }}>
              {loading ? <><Spinner /> Creating account…</> : 'Continue →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: G.text3 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: G.blue, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
