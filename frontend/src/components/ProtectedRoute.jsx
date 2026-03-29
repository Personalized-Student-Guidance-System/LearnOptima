import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOnboardingRedirect } from '../utils/onboardingRedirect';
import Layout from './Layout';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #d0d0ca', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const redirect = getOnboardingRedirect(user);
  if (redirect !== '/dashboard') {
    return <Navigate to={redirect} replace />;
  }

  return <Layout>{children}</Layout>;
}

export function OnboardingGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f7f5',
        gap: 16,
        padding: 24,
      }}>
        <div style={{ width: 24, height: 24, border: '2px solid #d0d0ca', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 14, color: '#6b6b63' }}>Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
