import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import onboardingService from '../../services/onboardingService';
import OnboardingLayout from '../../components/OnboardingLayout';
import { Spinner } from '../../design/ui';
import { G } from '../../design/tokens';

const BRANCHES = [
  'CSE', 'ECE', 'EEE', 'ME', 'CE', 'Mechanical Engineering', 'Civil Engineering',
  'Electrical Engineering', 'Electronics Engineering', 'Information Technology', 
  'Computer Science', 'Biomedical Engineering', 'Chemical Engineering', 
  'Aerospace Engineering', 'Automobile Engineering', 'Production Engineering',
  'Thermal Engineering', 'Power Engineering', 'Structural Engineering',
  'Environmental Engineering', 'Petroleum Engineering', 'Geological Engineering',
  'Mining Engineering', 'Marine Engineering', 'Textile Engineering',
  'Software Engineering', 'Data Science', 'AI/ML', 'IoT Engineering', 
  'Robotics Engineering', 'Metallurgy Engineering', 'Other'
];

const CAREER_ROLES = [
  'Software Engineer',
  'Data Scientist',
  'DevOps Engineer',
  'ML Engineer',
  'Product Manager',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Cloud Architect',
  'Security Engineer'
];

export default function Step1Profile() {
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState(4);
  const [goal, setGoal] = useState('');
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 2);
  const [targetRole, setTargetRole] = useState('');
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
      if (p?.targetRole) setTargetRole(p.targetRole);
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
        targetRole: targetRole || undefined,
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
      subtitle="Tell us about yourself so we can personalize your learning path."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 14, fontSize: 12, color: G.red }}>
            {error}
          </div>
        )}
        
        {/* Row 1: Branch & Semester */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label className="field-label" style={{ fontSize: 12, marginBottom: 4 }}>Branch</label>
            <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">Select branch</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" style={{ fontSize: 12, marginBottom: 4 }}>Semester</label>
            <select className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value))} style={{ fontSize: 13 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>Sem {s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Target Role & Career Goal */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label className="field-label" style={{ fontSize: 12, marginBottom: 4 }}>Target Role</label>
            <select className="input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">Select role</option>
              {CAREER_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" style={{ fontSize: 12, marginBottom: 4 }}>Target Year</label>
            <input className="input" type="number" min={new Date().getFullYear()} value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} style={{ fontSize: 13 }} />
          </div>
        </div>

        {/* Row 3: Career Goal (Full width) */}
        <div style={{ marginBottom: 12 }}>
          <label className="field-label" style={{ fontSize: 12, marginBottom: 4 }}>Career Goal (Optional)</label>
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Become a Data Scientist" style={{ fontSize: 13 }} />
        </div>

        {/* Row 4: Interests (Compact) */}
        <div style={{ marginBottom: 16 }}>
          <label className="field-label" style={{ fontSize: 12, marginBottom: 6 }}>Interests</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input 
              className="input" 
              value={interestInput} 
              onChange={(e) => setInterestInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())} 
              placeholder="Add interests..." 
              style={{ flex: 1, fontSize: 13 }} 
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={addInterest} style={{ padding: '8px 12px' }}>Add</button>
          </div>
          {interests.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {interests.map((x, i) => (
                <span key={i} className="badge" style={{ background: G.blueBg, color: G.blue, border: `1px solid ${G.blueBd}`, fontSize: 11, padding: '4px 8px' }}>
                  {x} <button type="button" onClick={() => removeInterest(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 6, fontSize: 12 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
          {loading ? <><Spinner /> Saving…</> : 'Continue →'}
        </button>
      </form>
    </OnboardingLayout>
  );
}
