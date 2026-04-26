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
      // Only pre-fill with plain strings — never with parsed object-shaped projects
      if (Array.isArray(p?.projects)) {
        const stringProjects = p.projects.filter(x => typeof x === 'string');
        if (stringProjects.length) setProjects(stringProjects);
      }
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
      title="Skills & Projects"
      subtitle="Add any additional skills or projects not covered in your resume."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 14, fontSize: 12, color: G.red }}>
            {error}
          </div>
        )}
        
        <div style={{ marginBottom: 14 }}>
          <SkillInput 
            label="Skills" 
            value={extraSkills} 
            onChange={setExtraSkills} 
            placeholder="e.g. React, Docker, AWS" 
          />
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <SkillInput 
            label="Projects" 
            value={projects} 
            onChange={setProjects} 
            placeholder="e.g. AI Chatbot, E-commerce App" 
          />
        </div>
        
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
          {loading ? <><Spinner /> Saving…</> : 'Continue →'}
        </button>
      </form>
    </OnboardingLayout>
  );
}
