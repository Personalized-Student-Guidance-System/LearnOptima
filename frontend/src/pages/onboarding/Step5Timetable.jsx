import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import onboardingService from '../../services/onboardingService';
import OnboardingLayout from '../../components/OnboardingLayout';
import FileUpload from '../../components/FileUpload';
import { Spinner } from '../../design/ui';
import { G } from '../../design/tokens';

export default function Step5Timetable() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a timetable image');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('timetable', file);
      await onboardingService.uploadTimetable(formData);
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={5}
      title="Upload Timetable"
      subtitle="Share your weekly schedule for smart task planning."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: G.redBg, border: `1px solid ${G.redBd}`, marginBottom: 14, fontSize: 12, color: G.red }}>
            {error}
          </div>
        )}
        <FileUpload label="Timetable (image)" accept=".jpg,.jpeg,.png,.webp" value={file} onChange={setFile} />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
          {loading ? <><Spinner /> Completing setup…</> : 'Finish setup →'}
        </button>
      </form>
    </OnboardingLayout>
  );
}
