import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Ic, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    college: '',
    branch: '',
    semester: '',
    targetRole: '',
    bio: '',
    cgpa: '',
    skills: [],
    interests: [],
    resumeUrl: '',
    syllabusUrl: '',
    timetableUrl: '',
    extractedSkills: [],
    extractedEducation: [],
    extractedExperience: [],
    extractedCertifications: [],
    projects: [],
    resumeParsed: null,
    syllabusSubjects: [],
    syllabusStructure: { subjects: [] },
    timetable: { days: [], timeSlots: [], grid: [] },
    parsingInfo: null,
  });
  const [newSkill, setNewSkill] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openingDoc, setOpeningDoc] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [reparseMessage, setReparseMessage] = useState('');

  const applyProfileData = (d) => {
    setForm((f) => ({
      ...f,
      ...d,
      semester: d.semester ?? '',
      cgpa: d.cgpa != null && d.cgpa !== '' ? String(d.cgpa) : '',
      skills: d.skills || [],
      interests: d.interests || [],
      syllabusStructure: d.syllabusStructure || { subjects: [] },
      parsingInfo: d.parsingInfo || null,
    }));
  };

  const loadProfile = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      setReparseMessage('');
    }
    try {
      const r = await axios.get('/profile');
      applyProfileData(r.data);
    } catch {
      if (user) setForm((f) => ({ ...f, name: user.name || '', email: user.email || '' }));
    } finally {
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get('/profile')
      .then((r) => {
        if (!cancelled) applyProfileData(r.data);
      })
      .catch(() => {
        if (!cancelled && user) setForm((f) => ({ ...f, name: user.name || '', email: user.email || '' }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/profile', {
        name: form.name,
        email: form.email,
        college: form.college,
        branch: form.branch,
        semester: form.semester === '' ? undefined : Number(form.semester),
        targetRole: form.targetRole,
        bio: form.bio,
        cgpa: form.cgpa === '' ? undefined : form.cgpa,
        skills: form.skills,
        interests: form.interests,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {
    } finally {
      setSaving(false);
    }
  };

  const addTag = (key, val, setter) => {
    if (!val.trim()) return;
    setForm((f) => ({ ...f, [key]: [...(f[key] || []), val.trim()] }));
    setter('');
  };
  const removeTag = (key, val) => setForm((f) => ({ ...f, [key]: (f[key] || []).filter((v) => v !== val) }));

  const reparseDocuments = async () => {
    setReparsing(true);
    setReparseMessage('');
    try {
      const r = await axios.post('/profile/reparse');
      applyProfileData(r.data);
      const res = r.data.reparseResults;
      if (res?.errors?.length) {
        setReparseMessage(`Done with notes: ${res.errors.join(' · ')}`);
      } else {
        setReparseMessage('Re-parse finished. Counts: ' + [
          res?.resume ? `resume extracted skills ${res.resume.extractedSkills}, total project rows stored ${res.resume.totalProjectsStored}` : null,
          res?.syllabus ? `syllabus subject blocks ${res.syllabus.subjectGroups}, flat subject names ${res.syllabus.flatNames}` : null,
        ].filter(Boolean).join(' · ') || 'saved.');
      }
    } catch (e) {
      setReparseMessage(e.response?.data?.message || e.message || 'Re-parse failed');
    } finally {
      setReparsing(false);
    }
  };

  const openDocument = (type) => {
    const directUrl = type === 'resume' ? form.resumeUrl : type === 'syllabus' ? form.syllabusUrl : form.timetableUrl;
    setOpeningDoc(type);
    const token = localStorage.getItem('sf_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const mimeType = type === 'timetable' ? 'image/png' : 'application/pdf';
    axios
      .get(`/profile/documents/${type}`, { responseType: 'blob', headers })
      .then((r) => {
        const contentType = r.headers['content-type'] || mimeType;
        const blob = new Blob([r.data], { type: contentType.split(';')[0].trim() || mimeType });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank', 'noopener');
        if (win) win.addEventListener('load', () => URL.revokeObjectURL(url));
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (directUrl && directUrl.startsWith('http')) window.open(directUrl, '_blank', 'noopener');
      })
      .finally(() => setOpeningDoc(null));
  };

  const initials = form.name ? form.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'S';
  const roles = ['Software Engineer', 'Data Scientist', 'DevOps Engineer', 'Frontend Developer', 'Backend Developer', 'ML Engineer', 'Machine Learning Engineer', 'Cybersecurity Analyst', 'Product Manager'];

  const subjects = form.syllabusStructure?.subjects || [];

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #d0d0ca', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 960 }}>
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Profile</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Your account, onboarding data, and parsed resume & syllabus.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing || reparsing} onClick={() => loadProfile(true)}>
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={refreshing || reparsing} onClick={() => reparseDocuments()}>
            {reparsing ? 'Re-parsing…' : 'Re-parse resume & syllabus'}
          </button>
        </div>
      </div>
      {reparseMessage && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: G.bg2, border: `1px solid ${G.border}`, fontSize: 12, color: G.text2 }}>
          {reparseMessage}
        </div>
      )}
      {form.parsingInfo && (
        <div className="card card-md" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>How parsing works</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: G.text2, lineHeight: 1.6 }}>
            <li><strong>ML:</strong> {form.parsingInfo.mlServiceConfigured ? 'ML_SERVICE_URL is set — resume may call your Python /ml/parse-resume API for extra skills/projects.' : 'ML_SERVICE_URL is not set — resume uses Node-only parsing.'}</li>
            <li>{form.parsingInfo.resumeHowItWorks}</li>
            <li>{form.parsingInfo.syllabusHowItWorks}</li>
            <li>{form.parsingInfo.limitation}</li>
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-lg" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 800, color: G.white }}>{initials}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: G.text }}>{form.name || 'Student'}</div>
            <div style={{ fontSize: 12, color: G.text2, marginTop: 4 }}>{form.email || '—'}</div>
            <div style={{ height: 1, background: G.border, margin: '14px 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Skills', val: (form.skills || []).length },
                { label: 'Interests', val: (form.interests || []).length },
                { label: 'Semester', val: form.semester ? `${form.semester}` : '—' },
                { label: 'Branch', val: String(form.branch || '—').slice(0, 8) },
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
              { label: 'Branch', val: form.branch || '—' },
              { label: 'Semester', val: form.semester ? `${form.semester}` : '—' },
              { label: 'College', val: form.college || '—' },
              { label: 'CGPA', val: form.cgpa ? `${form.cgpa}/10` : '—' },
              { label: 'Target Role', val: form.targetRole || '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${G.border}`, fontSize: 12 }}>
                <span style={{ color: G.text3 }}>{label}</span>
                <span style={{ color: G.text, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-md">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Basic Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="field-label">Full Name</label><input className="input" value={form.name} onChange={set('name')} /></div>
              <div><label className="field-label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
              <div><label className="field-label">College</label><input className="input" value={form.college} onChange={set('college')} /></div>
              <div>
                <label className="field-label">Branch</label>
                <select className="input" value={form.branch} onChange={set('branch')}>
                  <option value="">Select branch</option>
                  {['CSE', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'Computer Science', 'Other'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Semester</label>
                <select className="input" value={form.semester} onChange={set('semester')}>
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">CGPA (optional)</label>
                <input className="input" type="number" min={0} max={10} step={0.01} value={form.cgpa} onChange={set('cgpa')} />
              </div>
              <div>
                <label className="field-label">Target Role</label>
                <select className="input" value={form.targetRole} onChange={set('targetRole')}>
                  <option value="">Select target role</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div><label className="field-label">Bio</label><textarea className="input" rows={2} style={{ resize: 'vertical' }} value={form.bio} onChange={set('bio')} /></div>
          </div>

          <div className="card card-md">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Skills (editable)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(form.skills || []).map((s) => (
                <span key={s} className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`, cursor: 'pointer', fontSize: 12 }} onClick={() => removeTag('skills', s)}>
                  {s} <Ic path={ICONS.x} size={9} color={G.blue} sw={2.5} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill…" onKeyDown={(e) => e.key === 'Enter' && addTag('skills', newSkill, setNewSkill)} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTag('skills', newSkill, setNewSkill)}><Ic path={ICONS.plus} size={12} /> Add</button>
            </div>
          </div>

          <div className="card card-md">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Interests</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(form.interests || []).map((i) => (
                <span key={i} className="badge" style={{ background: G.purpleBg, color: G.purple, border: `1px solid ${G.purpleBd}`, cursor: 'pointer', fontSize: 12 }} onClick={() => removeTag('interests', i)}>
                  {i} <Ic path={ICONS.x} size={9} color={G.purple} sw={2.5} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={newInterest} onChange={(e) => setNewInterest(e.target.value)} placeholder="Add an interest…" onKeyDown={(e) => e.key === 'Enter' && addTag('interests', newInterest, setNewInterest)} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTag('interests', newInterest, setNewInterest)}><Ic path={ICONS.plus} size={12} /> Add</button>
            </div>
          </div>

          {(form.resumeUrl || form.syllabusUrl || form.timetableUrl) && (
            <div className="card card-md">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Documents</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {form.resumeUrl && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={openingDoc !== null} onClick={() => openDocument('resume')}>
                    {openingDoc === 'resume' ? 'Opening…' : 'View resume'}
                  </button>
                )}
                {form.syllabusUrl && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={openingDoc !== null} onClick={() => openDocument('syllabus')}>
                    {openingDoc === 'syllabus' ? 'Opening…' : 'View syllabus'}
                  </button>
                )}
                {form.timetableUrl && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={openingDoc !== null} onClick={() => openDocument('timetable')}>
                    {openingDoc === 'timetable' ? 'Opening…' : 'View timetable'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="card card-md">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>From your resume</div>
              {!form.resumeUrl && (
                <p style={{ fontSize: 12, color: G.text3, marginBottom: 12 }}>No resume on file. Complete onboarding step 2 or re-upload a resume.</p>
              )}
              {form.extractedSkills?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 6 }}>Skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {form.extractedSkills.map((s) => (
                      <span key={s} className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`, fontSize: 11 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {form.extractedEducation?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 6 }}>Education</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: G.text2 }}>{form.extractedEducation.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              {form.extractedExperience?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 6 }}>Experience</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: G.text2 }}>{form.extractedExperience.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              {form.extractedCertifications?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 6 }}>Certifications</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: G.text2 }}>{form.extractedCertifications.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              {form.projects?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 6 }}>Projects</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: G.text2 }}>{form.projects.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
              {form.resumeUrl &&
                !form.extractedSkills?.length &&
                !form.extractedEducation?.length &&
                !form.extractedExperience?.length &&
                !form.extractedCertifications?.length &&
                !form.projects?.length && (
                  <p style={{ fontSize: 12, color: G.text3, margin: 0 }}>
                    Nothing extracted yet. Try <strong>Re-parse resume & syllabus</strong> above, or re-upload in onboarding. Scanned PDFs have no text for the parser.
                  </p>
                )}
            </div>

          <div className="card card-md">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Syllabus (subjects → chapters → topics)</div>
              {!form.syllabusUrl && (
                <p style={{ fontSize: 12, color: G.text3, marginBottom: 12 }}>No syllabus on file. Complete onboarding step 4.</p>
              )}
              {subjects.length === 0 && form.syllabusUrl && (
                <p style={{ fontSize: 12, color: G.text3, marginBottom: 12 }}>
                  No structured syllabus yet. Use <strong>Re-parse resume & syllabus</strong> or re-upload the PDF. Layout must contain readable text (not scanned images).
                </p>
              )}
              <div style={{ maxHeight: 420, overflow: 'auto', fontSize: 12 }}>
                {subjects.map((sub, si) => (
                  <div key={si} style={{ marginBottom: 16, borderLeft: `3px solid ${G.blue}`, paddingLeft: 12 }}>
                    <div style={{ fontWeight: 700, color: G.text, marginBottom: 8 }}>{sub.name}</div>
                    {(sub.chapters || []).map((ch, ci) => (
                      <div key={ci} style={{ marginBottom: 10, marginLeft: 4 }}>
                        <div style={{ fontWeight: 600, color: G.text2, marginBottom: 4 }}>{ch.name}</div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: G.text3 }}>
                          {(ch.topics || []).slice(0, 40).map((t, ti) => (
                            <li key={ti}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Spinner /> Saving…</> : saved ? '✓ Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
