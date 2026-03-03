import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Ic, StatCard, Spinner } from '../design/ui';
import { G, ICONS } from '../design/tokens';

const barColors = [G.blue, G.amber, G.green, G.red, G.purple, G.blue];

const grade = pct => pct >= 90 ? 'O' : pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B+' : pct >= 50 ? 'B' : 'F';
const gradeColor = g => ({ O: G.green, 'A+': G.blue, A: G.purple, 'B+': G.amber, B: G.amber, F: G.red }[g] || G.text);
const gradeBg    = g => ({ O: G.greenBg, 'A+': G.blueBg, A: G.purpleBg, 'B+': G.amberBg, B: G.amberBg, F: G.redBg }[g] || G.bg);
const gradeBd    = g => ({ O: G.greenBd, 'A+': G.blueBd, A: G.purpleBd, 'B+': G.amberBd, B: G.amberBd, F: G.redBd }[g] || G.border);

export default function AcademicData() {
  const [subjects,   setSubjects]  = useState([]);
  const [cgpaData,   setCgpaData]  = useState(null);
  const [showModal,  setShowModal] = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [anim,       setAnim]      = useState(false);
  const [form, setForm] = useState({ name: '', semester: 1, credits: 3, marks: { internal1: 0, internal2: 0, external: 0 }, attendance: 75 });

  useEffect(() => {
    requestAnimationFrame(() => setAnim(true));
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subRes, cgpaRes] = await Promise.all([axios.get('/academic'), axios.get('/academic/cgpa')]);
      setSubjects(subRes.data);
      setCgpaData(cgpaRes.data);
    } catch {}
  };

  const addSubject = async () => {
    setSaving(true);
    try { await axios.post('/academic', form); setShowModal(false); fetchData(); } catch {} finally { setSaving(false); }
  };

  const deleteSubject = async (id) => {
    try { await axios.delete(`/academic/${id}`); fetchData(); } catch {}
  };

  // Demo data if no subjects
  const displaySubjects = subjects.length > 0 ? subjects : [
    { _id: '1', name: 'Data Structures & Algorithms', code: 'CS301', marks: { internal1: 25, internal2: 23, external: 85 }, credits: 4, attendance: 92, semester: 6 },
    { _id: '2', name: 'Operating Systems',            code: 'CS302', marks: { internal1: 20, internal2: 22, external: 72 }, credits: 3, attendance: 78, semester: 6 },
    { _id: '3', name: 'Database Management',          code: 'CS303', marks: { internal1: 28, internal2: 26, external: 91 }, credits: 4, attendance: 96, semester: 6 },
    { _id: '4', name: 'Computer Networks',            code: 'CS304', marks: { internal1: 18, internal2: 19, external: 68 }, credits: 3, attendance: 65, semester: 6 },
    { _id: '5', name: 'Machine Learning',             code: 'CS305', marks: { internal1: 26, internal2: 25, external: 88 }, credits: 4, attendance: 90, semester: 6 },
    { _id: '6', name: 'Software Engineering',         code: 'CS306', marks: { internal1: 22, internal2: 23, external: 79 }, credits: 3, attendance: 83, semester: 6 },
  ];

  const getScore = s => {
    const { internal1 = 0, internal2 = 0, external = 0 } = s.marks || {};
    return Math.round((internal1 + internal2) * 0.3 + external * 0.7);
  };

  const avg    = displaySubjects.length ? Math.round(displaySubjects.reduce((a, s) => a + getScore(s), 0) / displaySubjects.length) : 0;
  const avgAtt = displaySubjects.length ? Math.round(displaySubjects.reduce((a, s) => a + (s.attendance || 0), 0) / displaySubjects.length) : 0;
  const totalCredits = displaySubjects.reduce((a, s) => a + (s.credits || 0), 0);

  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Academics</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>Marks, grades, and CGPA tracking</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Ic path={ICONS.plus} size={12} /> Add Subject</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="CGPA"           value={cgpaData?.cgpa || '8.4'} unit="/10" color="blue"   icon="star"  sub="Based on all subjects" />
        <StatCard label="Avg Score"      value={avg}  unit="%" color="green"  icon="trend" sub={`Best: ${Math.max(...displaySubjects.map(s => getScore(s)))}%`} />
        <StatCard label="Avg Attendance" value={avgAtt} unit="%" color={avgAtt >= 75 ? 'green' : 'red'} sub={avgAtt < 75 ? '⚠ Below 75% threshold' : 'Above minimum'} />
        <StatCard label="Credit Hours"   value={totalCredits} color="purple" sub="Total this semester" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Subject Records</span>
            <button className="btn btn-ghost btn-sm"><Ic path={ICONS.filter} size={12} /> Sort</button>
          </div>
          <table className="table">
            <thead>
              <tr><th>Subject</th><th>Int-1</th><th>Int-2</th><th>External</th><th>Score</th><th>Grade</th><th>Attend.</th><th>Credits</th><th></th></tr>
            </thead>
            <tbody>
              {displaySubjects.map((s, i) => {
                const score = getScore(s);
                const g = grade(score);
                return (
                  <tr key={s._id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className="mono">{s.marks?.internal1}</td>
                    <td className="mono">{s.marks?.internal2}</td>
                    <td className="mono">{s.marks?.external}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 50 }}><div className="progress-track" style={{ height: 3 }}><div className="progress-bar" style={{ width: `${score}%`, background: barColors[i % barColors.length] }} /></div></div>
                        <span className="mono" style={{ fontSize: 12 }}>{score}%</span>
                      </div>
                    </td>
                    <td><span className="badge" style={{ background: gradeBg(g), color: gradeColor(g), border: `1px solid ${gradeBd(g)}` }}>{g}</span></td>
                    <td><span className="mono" style={{ fontSize: 12, color: s.attendance < 75 ? G.red : G.text }}>{s.attendance}%</span></td>
                    <td><span className="mono" style={{ fontSize: 12, color: G.text2 }}>{s.credits}</span></td>
                    <td>
                      {subjects.length > 0 && (
                        <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px' }} onClick={() => deleteSubject(s._id)}>
                          <Ic path={ICONS.trash} size={12} color={G.text3} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bar chart */}
        <div className="card card-md">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20 }}>Score Breakdown</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
            {displaySubjects.map((s, i) => {
              const score = getScore(s);
              const g = grade(score);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span className="mono" style={{ fontSize: 9, color: gradeColor(g), fontWeight: 700 }}>{g}</span>
                  <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: barColors[i % barColors.length], height: anim ? `${score}%` : '0%', transition: `height 0.6s ${i * 0.08}s ease` }} />
                  </div>
                  <span className="mono" style={{ fontSize: 9, color: G.text3 }}>S{i + 1}</span>
                </div>
              );
            })}
          </div>
          <div style={{ height: 1, background: G.border, margin: '16px 0' }} />
          {[
            { label: 'Highest',  val: `${Math.max(...displaySubjects.map(s => getScore(s)))}%` },
            { label: 'Lowest',   val: `${Math.min(...displaySubjects.map(s => getScore(s)))}%` },
            { label: 'CGPA',     val: `${cgpaData?.cgpa || '8.4'}/10` },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: G.text2 }}>{label}</span>
              <span className="mono" style={{ fontWeight: 600, color: G.text }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card card-lg" style={{ width: 500, animation: 'fadeSlideUp 0.2s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Add Subject</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: 'span 2' }}><label className="field-label">Subject Name</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Data Structures" /></div>
              <div>
                <label className="field-label">Semester</label>
                <select className="input" value={form.semester} onChange={e => setForm({...form, semester: Number(e.target.value)})}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <div><label className="field-label">Credits</label><input className="input" type="number" min="1" max="6" value={form.credits} onChange={e => setForm({...form, credits: Number(e.target.value)})} /></div>
              <div><label className="field-label">Internal 1 (/ 30)</label><input className="input" type="number" min="0" max="30" value={form.marks.internal1} onChange={e => setForm({...form, marks: {...form.marks, internal1: Number(e.target.value)}})} /></div>
              <div><label className="field-label">Internal 2 (/ 30)</label><input className="input" type="number" min="0" max="30" value={form.marks.internal2} onChange={e => setForm({...form, marks: {...form.marks, internal2: Number(e.target.value)}})} /></div>
              <div><label className="field-label">External (/ 100)</label><input className="input" type="number" min="0" max="100" value={form.marks.external} onChange={e => setForm({...form, marks: {...form.marks, external: Number(e.target.value)}})} /></div>
              <div><label className="field-label">Attendance %</label><input className="input" type="number" min="0" max="100" value={form.attendance} onChange={e => setForm({...form, attendance: Number(e.target.value)})} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addSubject} disabled={saving}>{saving ? <><Spinner /> Saving…</> : 'Add Subject'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}