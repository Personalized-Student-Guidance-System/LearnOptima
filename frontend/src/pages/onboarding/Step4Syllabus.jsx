import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import onboardingService from '../../services/onboardingService';
import OnboardingLayout from '../../components/OnboardingLayout';
import FileUpload from '../../components/FileUpload';
import { Spinner } from '../../design/ui';
import { G } from '../../design/tokens';

export default function Step4Syllabus() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a syllabus file');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('syllabus', file);
      await onboardingService.uploadSyllabus(formData);
      await refreshUser();
      navigate('/onboarding/step5');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={4}
      title="Upload Syllabus"
      subtitle="Upload your semester syllabus so we can align your planner with subjects."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 16, fontSize: 13, color: G.red }}>
            {error}
          </div>
        )}
        <FileUpload label="Syllabus (PDF or DOC)" accept=".pdf,.doc,.docx" value={file} onChange={setFile} />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? <><Spinner /> Uploading…</> : 'Continue →'}
        </button>
      </form>
    </OnboardingLayout>
  );
}
