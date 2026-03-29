import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import onboardingService from '../../services/onboardingService';
import OnboardingLayout from '../../components/OnboardingLayout';
import SkillInput from '../../components/SkillInput';
import { Spinner } from '../../design/ui';
import { G } from '../../design/tokens';

export default function Step3Skills() {
  const [extraSkills, setExtraSkills] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    onboardingService.getProfile().then((r) => {
      const p = r.data;
      if (p?.extraSkills?.length) setExtraSkills(p.extraSkills);
      if (p?.projects?.length) setProjects(p.projects);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onboardingService.saveSkills({ extraSkills, projects });
      await refreshUser();
      navigate('/onboarding/step4');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={3}
      title="Extra Skills & Projects"
      subtitle="Add any skills or projects not on your resume."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 16, fontSize: 13, color: G.red }}>
            {error}
          </div>
        )}
        <SkillInput label="Extra skills" value={extraSkills} onChange={setExtraSkills} placeholder="e.g. React, Docker" />
        <SkillInput label="Projects" value={projects} onChange={setProjects} placeholder="e.g. AI Chatbot" />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
          {loading ? <><Spinner /> Saving…</> : 'Continue →'}
        </button>
      </form>
    </OnboardingLayout>
  );
}
