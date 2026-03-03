import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../design/ui';
import { G } from '../design/tokens';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', college: '', branch: '', semester: 1 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: G.bg, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 520, animation: 'fadeSlideUp 0.4s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="white"><path d="M6 1L10.5 4V8L6 11L1.5 8V4L6 1Z"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: G.text }}>StudentFriend</span>
        </div>

        <div className="card card-lg">
          <h2 style={{ fontSize: 20, fontWeight: 800, color: G.text, letterSpacing: '-0.02em', marginBottom: 4 }}>Create your account</h2>
          <p style={{ fontSize: 13, color: G.text2, marginBottom: 24 }}>Get started with your AI-powered academic companion</p>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 16, fontSize: 13, color: G.red }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="field-label">Full Name</label><input className="input" value={form.name} onChange={set('name')} placeholder="Arjun Sharma" required /></div>
              <div><label className="field-label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@student.edu" required /></div>
              <div><label className="field-label">Password</label><input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required /></div>
              <div><label className="field-label">College</label><input className="input" value={form.college} onChange={set('college')} placeholder="MIT Manipal" /></div>
              <div>
                <label className="field-label">Branch</label>
                <input className="input" value={form.branch} onChange={set('branch')} placeholder="Computer Science" />
              </div>
              <div>
                <label className="field-label">Semester</label>
                <select className="input" value={form.semester} onChange={set('semester')}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 14, marginTop: 8 }}>
              {loading ? <><Spinner /> Creating account…</> : 'Create Account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: G.text3 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: G.blue, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}