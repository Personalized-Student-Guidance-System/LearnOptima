import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

export default function Profile() {
  const { user } = useAuth();
  const [form,        setForm]       = useState({ name: '', email: '', college: '', branch: '', semester: 6, targetRole: '', bio: '', skills: [], interests: [] });
  const [newSkill,    setNewSkill]   = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [saving,      setSaving]     = useState(false);
  const [saved,       setSaved]      = useState(false);

  useEffect(() => {
    axios.get('/profile').then(r => setForm({ ...r.data, skills: r.data.skills || [], interests: r.data.interests || [], bio: r.data.bio || '' })).catch(() => {
      if (user) setForm(f => ({ ...f, name: user.name || '', email: user.email || '' }));
    });
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/profile', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  const addTag = (key, val, setter) => {
    if (!val.trim()) return;
    setForm(f => ({ ...f, [key]: [...(f[key] || []), val.trim()] }));
    setter('');
  };
  const removeTag = (key, val) => setForm(f => ({ ...f, [key]: (f[key] || []).filter(v => v !== val) }));

  const initials = form.name ? form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'S';
  const roles = ['Software Engineer','Data Scientist','DevOps Engineer','Frontend Developer','Backend Developer','ML Engineer','Cybersecurity Analyst','Product Manager'];

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Profile</h1>
        <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Manage your academic profile and personalization</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* Left identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-lg" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 800, color: G.white }}>{initials}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: G.text, letterSpacing: '-0.01em' }}>{form.name || 'Student'}</div>
            <div style={{ fontSize: 12, color: G.text2, marginTop: 4 }}>{form.email}</div>
            <div style={{ height: 1, background: G.border, margin: '14px 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Skills',    val: (form.skills || []).length },
                { label: 'Interests', val: (form.interests || []).length },
                { label: 'Semester',  val: `${form.semester}th` },
                { label: 'Branch',    val: (form.branch || 'CS').slice(0, 5) },
              ].map(({ label, val }) => (
                <div key={label} style={{ padding: 8, borderRadius: 6, background: G.bg, border: `1px solid ${G.border}` }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: G.text }}>{val}</div>
                  <div style={{ fontSize: 10, color: G.text3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${G.border}`, fontSize: 12, fontWeight: 700 }}>Quick Info</div>
            {[
              { label: 'Branch',      val: form.branch || 'Computer Science' },
              { label: 'Semester',    val: `${form.semester}th` },
              { label: 'College',     val: form.college || '—' },
              { label: 'Target Role', val: form.targetRole || '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${G.border}`, fontSize: 12 }}>
                <span style={{ color: G.text3 }}>{label}</span>
                <span style={{ color: G.text, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-md">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Basic Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="field-label">Full Name</label><input className="input" value={form.name} onChange={set('name')} /></div>
              <div><label className="field-label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
              <div><label className="field-label">College</label><input className="input" value={form.college} onChange={set('college')} placeholder="MIT Manipal" /></div>
              <div>
                <label className="field-label">Branch</label>
                <select className="input" value={form.branch} onChange={set('branch')}>
                  <option value="">Select branch</option>
                  {['Computer Science','Information Technology','Electronics','Mechanical','Civil'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Semester</label>
                <select className="input" value={form.semester} onChange={set('semester')}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Target Role</label>
                <select className="input" value={form.targetRole} onChange={set('targetRole')}>
                  <option value="">Select target role</option>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div><label className="field-label">Bio</label><textarea className="input" rows={2} style={{ resize: 'vertical' }} value={form.bio} onChange={set('bio')} placeholder="Final year CS student passionate about AI/ML…" /></div>
          </div>

          <div className="card card-md">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Skills</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(form.skills || []).map(s => (
                <span key={s} className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`, cursor: 'pointer', fontSize: 12 }} onClick={() => removeTag('skills', s)}>
                  {s} <Ic path={ICONS.x} size={9} color={G.blue} sw={2.5} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={newSkill} onChange={e => setNewSkill(e.target.value)} placeholder="Add a skill…" onKeyDown={e => e.key === 'Enter' && addTag('skills', newSkill, setNewSkill)} />
              <button className="btn btn-secondary btn-sm" onClick={() => addTag('skills', newSkill, setNewSkill)}><Ic path={ICONS.plus} size={12} /> Add</button>
            </div>
          </div>

          <div className="card card-md">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Interests</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(form.interests || []).map(i => (
                <span key={i} className="badge" style={{ background: G.purpleBg, color: G.purple, border: `1px solid ${G.purpleBd}`, cursor: 'pointer', fontSize: 12 }} onClick={() => removeTag('interests', i)}>
                  {i} <Ic path={ICONS.x} size={9} color={G.purple} sw={2.5} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={newInterest} onChange={e => setNewInterest(e.target.value)} placeholder="Add an interest…" onKeyDown={e => e.key === 'Enter' && addTag('interests', newInterest, setNewInterest)} />
              <button className="btn btn-secondary btn-sm" onClick={() => addTag('interests', newInterest, setNewInterest)}><Ic path={ICONS.plus} size={12} /> Add</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Spinner /> Saving…</> : saved ? '✓ Saved!' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}