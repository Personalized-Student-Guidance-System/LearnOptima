import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function AcademicData() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [cgpaData, setCgpaData] = useState(null);
  const [ocrUploading, setOcrUploading] = useState(false);
  
  const [extractedSubjects, setExtractedSubjects] = useState([]);
  const [ocrStats, setOcrStats] = useState({ semester: 1, sgpa: '', cgpa: '' });
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subRes, cgpaRes] = await Promise.all([
        axios.get('/academic'),
        axios.get('/academic/cgpa')
      ]);
      setSubjects(subRes.data);
      setCgpaData(cgpaRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const currentSemester = user?.semester || 1;

  // OCR Upload
  const handleOcrUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrUploading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      try {
        const res = await axios.post('/ml/extract-gradesheet', {
          image: reader.result
        });

        if (res.data?.subjects?.length > 0) {
          const cleaned = res.data.subjects.map(s => ({
            code: s.code || "",
            name: s.name || "Unknown",
            grade: s.grade || "P",
            credits: s.credits || 3
          }));

          setExtractedSubjects(cleaned);
          setOcrStats({
            semester: currentSemester,
            sgpa: res.data.sgpa || '',
            cgpa: res.data.cgpa || ''
          });
          setShowOcrModal(true);
        } else {
          alert("No subjects detected. Try clearer image.");
        }
      } catch (err) {
        console.error(err);
        alert("OCR failed");
      } finally {
        setOcrUploading(false);
      }
    };
  };

  const saveExtracted = async () => {
    setSaving(true);
    try {
      await axios.post('/academic/bulk', {
        semester: ocrStats.semester,
        sgpa: ocrStats.sgpa,
        cgpa: ocrStats.cgpa,
        subjects: extractedSubjects.map(s => ({
          code: s.code,
          name: s.name,
          credits: Number(s.credits),
          grade: s.grade
        }))
      });

      setShowOcrModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to save subjects");
    } finally {
      setSaving(false);
    }
  };

  const handleEditChange = (e) => setEditForm({ ...editForm, [e.target.name]: e.target.value });

  const saveEdit = async (id) => {
    try {
      await axios.put(`/academic/${id}`, editForm);
      setEditingId(null);
      fetchData();
    } catch (err) {
      alert("Failed to update subject");
    }
  };

  // Group by Semesters 1 to 8
  const semestersData = {};
  for(let i = 1; i <= 8; i++) semestersData[i] = [];
  
  subjects.forEach(s => {
    if (s.semester >= 1 && s.semester <= 8) {
      semestersData[s.semester].push(s);
    }
  });

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Academic Portfolio & Progress</h2>
          <p>Global CGPA: <strong>{cgpaData?.cgpa || user?.cgpa || 0}</strong> | Current Sem: <strong>{currentSemester}</strong></p>
        </div>
        <label style={{ cursor: 'pointer', padding: '10px 15px', background: '#3b82f6', color: '#fff', borderRadius: '5px' }}>
          {ocrUploading ? "Scanning Document..." : "📄 Upload Marks Sheet"}
          <input type="file" accept="image/*" hidden onChange={handleOcrUpload} />
        </label>
      </div>

      <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => {
          const semSubs = semestersData[sem];
          
          if (sem > currentSemester && semSubs.length === 0) return null; // Don't show future sems
          
          if (sem < currentSemester && semSubs.length === 0) {
            return (
              <div key={sem} style={{ border: '1px dashed #ef4444', padding: '20px', borderRadius: '8px', background: '#fef2f2' }}>
                <h3 style={{ margin: 0, color: '#b91c1c' }}>Semester {sem} <span style={{ fontSize: 12, fontWeight: 'normal', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>Action Required</span></h3>
                <p style={{ margin: '8px 0 0', fontSize: 14 }}>No subjects recorded. Upload your Semester {sem} marks sheet to keep burnout predictions accurate!</p>
              </div>
            );
          }

          if (semSubs.length === 0) return null; // Edge case

          const sgpaDisplay = semSubs[0].sgpa ? ` | SGPA: ${semSubs[0].sgpa}` : '';
          
          return (
            <div key={sem} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f9fafb', padding: '10px 15px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Semester {sem} {sgpaDisplay}</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '10px' }}>Code</th>
                      <th style={{ padding: '10px' }}>Subject Name</th>
                      <th style={{ padding: '10px' }}>Cr</th>
                      <th style={{ padding: '10px' }}>Gr</th>
                      <th style={{ padding: '10px' }}>CIE</th>
                      <th style={{ padding: '10px' }}>ST1</th>
                      <th style={{ padding: '10px' }}>ST2</th>
                      <th style={{ padding: '10px' }}>ST3</th>
                      <th style={{ padding: '10px' }}>A1</th>
                      <th style={{ padding: '10px' }}>A2</th>
                      <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semSubs.map((s) => {
                      const isEditing = editingId === s._id;
                      return (
                        <tr key={s._id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '10px' }}>{s.code || '-'}</td>
                          <td style={{ padding: '10px' }}>{s.name}</td>
                          <td style={{ padding: '10px' }}>{s.credits}</td>
                          <td style={{ padding: '10px', color: '#16a34a', fontWeight: 'bold' }}>{s.grade}</td>
                          {isEditing ? (
                            <>
                              <td style={{ padding: '4px' }}><input type="number" name="cie" value={editForm.cie || ""} onChange={handleEditChange} style={{ width: 40 }} /></td>
                              <td style={{ padding: '4px' }}><input type="number" name="sliptest1" value={editForm.sliptest1 || ""} onChange={handleEditChange} style={{ width: 40 }} /></td>
                              <td style={{ padding: '4px' }}><input type="number" name="sliptest2" value={editForm.sliptest2 || ""} onChange={handleEditChange} style={{ width: 40 }} /></td>
                              <td style={{ padding: '4px' }}><input type="number" name="sliptest3" value={editForm.sliptest3 || ""} onChange={handleEditChange} style={{ width: 40 }} /></td>
                              <td style={{ padding: '4px' }}><input type="number" name="assignment1" value={editForm.assignment1 || ""} onChange={handleEditChange} style={{ width: 40 }} /></td>
                              <td style={{ padding: '4px' }}><input type="number" name="assignment2" value={editForm.assignment2 || ""} onChange={handleEditChange} style={{ width: 40 }} /></td>
                              <td style={{ padding: '10px' }}>
                                <button onClick={() => saveEdit(s._id)} style={{ padding: '4px 8px', background: '#3b82f6', color: 'white', borderRadius: 4, cursor: 'pointer', border: 'none' }}>Save</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '10px' }}>{s.cie || '-'}</td>
                              <td style={{ padding: '10px' }}>{s.sliptest1 || '-'}</td>
                              <td style={{ padding: '10px' }}>{s.sliptest2 || '-'}</td>
                              <td style={{ padding: '10px' }}>{s.sliptest3 || '-'}</td>
                              <td style={{ padding: '10px' }}>{s.assignment1 || '-'}</td>
                              <td style={{ padding: '10px' }}>{s.assignment2 || '-'}</td>
                              <td style={{ padding: '10px' }}>
                                <button 
                                  onClick={() => { setEditingId(s._id); setEditForm(s); }}
                                  style={{ padding: '4px 8px', border: '1px solid #d1d5db', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}
                                >Edit Internal Marks</button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* OCR Modal */}
      {showOcrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: 25, width: 800, maxHeight: '85vh', overflowY: 'auto', borderRadius: '12px' }}>
            <h2>Confirm Marksheet Details</h2>
            
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, padding: 15, background: '#f3f4f6', borderRadius: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>Semester</label>
                <input type="number" value={ocrStats.semester} onChange={(e) => setOcrStats({...ocrStats, semester: Number(e.target.value)})} style={{ padding: 8, width: 60 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>SGPA</label>
                <input type="number" step="0.01" value={ocrStats.sgpa} onChange={(e) => setOcrStats({...ocrStats, sgpa: e.target.value})} style={{ padding: 8, width: 80 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>CGPA (Cumulative)</label>
                <input type="number" step="0.01" value={ocrStats.cgpa} onChange={(e) => setOcrStats({...ocrStats, cgpa: e.target.value})} style={{ padding: 8, width: 80 }} />
              </div>
            </div>

            <table style={{ width: '100%', textAlign: 'left', marginBottom: 20 }}>
              <thead><tr><th>Code</th><th>Subject Name</th><th>Grade</th><th>Credits</th></tr></thead>
              <tbody>
                {extractedSubjects.map((sub, i) => (
                  <tr key={i}>
                    <td>
                      <input value={sub.code} onChange={(e) => { const n = [...extractedSubjects]; n[i].code = e.target.value; setExtractedSubjects(n); }} style={{ width: 80 }} />
                    </td>
                    <td>
                      <input value={sub.name} onChange={(e) => { const n = [...extractedSubjects]; n[i].name = e.target.value; setExtractedSubjects(n); }} style={{ width: '100%', minWidth: 200 }} />
                    </td>
                    <td>
                      <input value={sub.grade} onChange={(e) => { const n = [...extractedSubjects]; n[i].grade = e.target.value; setExtractedSubjects(n); }} style={{ width: 40 }} />
                    </td>
                    <td>
                      <input type="number" value={sub.credits} onChange={(e) => { const n = [...extractedSubjects]; n[i].credits = Number(e.target.value); setExtractedSubjects(n); }} style={{ width: 50 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowOcrModal(false)}
                style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                Cancel
              </button>
              <button 
                onClick={saveExtracted} disabled={saving}
                style={{ padding: '8px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                {saving ? "Saving Data..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}