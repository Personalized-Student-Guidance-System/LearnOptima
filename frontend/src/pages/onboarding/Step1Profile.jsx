import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import onboardingService from '../../services/onboardingService';
import OnboardingLayout from '../../components/OnboardingLayout';
import { Spinner } from '../../design/ui';
import { G } from '../../design/tokens';

const BRANCHES = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'Other'];

export default function Step1Profile() {
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState(4);
  const [goal, setGoal] = useState('');
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 2);
  const [interests, setInterests] = useState([]);
  const [interestInput, setInterestInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    onboardingService.getProfile().then((r) => {
      const p = r.data;
      if (p?.branch) setBranch(p.branch);
      if (p?.semester) setSemester(p.semester);
      if (p?.goals?.[0]) {
        setGoal(p.goals[0].goal);
        if (p.goals[0].targetYear) setTargetYear(p.goals[0].targetYear);
      }
      if (p?.interests?.length) setInterests(p.interests);
    }).catch(() => {});
  }, []);

  const addInterest = () => {
    const v = interestInput.trim();
    if (v && !interests.includes(v)) setInterests([...interests, v]);
    setInterestInput('');
  };

  const removeInterest = (i) => setInterests(interests.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onboardingService.saveProfile({
        branch: branch || undefined,
        semester,
        goal: goal || undefined,
        targetYear: goal ? targetYear : undefined,
        interests,
      });
      await refreshUser();
      navigate('/onboarding/step2');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={1}
      title="Profile & Goals"
      subtitle="Tell us your branch, semester, and career goal so we can personalize your roadmap."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 16, fontSize: 13, color: G.red }}>
            {error}
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Branch</label>
          <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Select branch</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Semester</label>
          <select className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Career goal</label>
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Machine Learning Engineer" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Target year (for goal)</label>
          <input className="input" type="number" min={new Date().getFullYear()} value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label className="field-label">Interests (add one by one)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="input" value={interestInput} onChange={(e) => setInterestInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())} placeholder="e.g. AI, Data Science" style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={addInterest}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {interests.map((x, i) => (
              <span key={i} className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}` }}>
                {x} <button type="button" onClick={() => removeInterest(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>×</button>
              </span>
            ))}
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? <><Spinner /> Saving…</> : 'Continue →'}
        </button>
      </form>
    </OnboardingLayout>
  );
}
