import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import onboardingService from '../../services/onboardingService';
import OnboardingLayout from '../../components/OnboardingLayout';
import FileUpload from '../../components/FileUpload';
import { Spinner } from '../../design/ui';
import { G } from '../../design/tokens';

export default function Step2Resume() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedSkills, setExtractedSkills] = useState([]);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a resume file');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await onboardingService.uploadResume(formData);
      setExtractedSkills(res.data?.extractedSkills || []);
      await refreshUser();
      navigate('/onboarding/step3');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={2}
      title="Upload Resume"
      subtitle="We'll extract skills and projects to personalize your skill gap analysis."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 16, fontSize: 13, color: G.red }}>
            {error}
          </div>
        )}
        <FileUpload label="Resume (PDF or DOC)" accept=".pdf,.doc,.docx" value={file} onChange={setFile} />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? <><Spinner /> Uploading & analyzing…</> : 'Continue →'}
        </button>
      </form>
    </OnboardingLayout>
  );
}
