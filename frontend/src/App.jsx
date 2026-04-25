import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useStudyTracking } from './hooks/useStudyTracking';
import { getOnboardingRedirect } from './utils/onboardingRedirect';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import SkillGap from './pages/SkillGap';
import CareerRoadmap from './pages/CareerRoadmap';
import BurnoutPredictor from './pages/BurnoutPredictor';
import GoalAnalyzer from './pages/GoalAnalyzer';
import AcademicData from './pages/AcademicData';
import Profile from './pages/Profile';
import Step1Profile from './pages/onboarding/Step1Profile';
import Step2Resume from './pages/onboarding/Step2Resume';
import Step3Skills from './pages/onboarding/Step3Skills';
import Step4Syllabus from './pages/onboarding/Step4Syllabus';
import Step5Timetable from './pages/onboarding/Step5Timetable';
import './styles/globals.css';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #d0d0ca', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

/** Logged-in users only; no main app chrome — full-screen onboarding */
function OnboardingRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingCompleted) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Requires login + completed onboarding; main app layout with study tracking */
function AppShellRoute({ children }) {
  const { user, loading } = useAuth();
  useStudyTracking(); // Initialize study tracking
  
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboardingCompleted) return <Navigate to={getOnboardingRedirect(user)} replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <LoadingScreen />
          ) : user ? (
            <Navigate to={user.onboardingCompleted ? '/dashboard' : getOnboardingRedirect(user)} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          loading ? (
            <LoadingScreen />
          ) : user ? (
            <Navigate to={user.onboardingCompleted ? '/dashboard' : getOnboardingRedirect(user)} replace />
          ) : (
            <Register />
          )
        }
      />

      <Route
        path="/onboarding/step1"
        element={
          <OnboardingRoute>
            <Step1Profile />
          </OnboardingRoute>
        }
      />
      <Route
        path="/onboarding/step2"
        element={
          <OnboardingRoute>
            <Step2Resume />
          </OnboardingRoute>
        }
      />
      <Route
        path="/onboarding/step3"
        element={
          <OnboardingRoute>
            <Step3Skills />
          </OnboardingRoute>
        }
      />
      <Route
        path="/onboarding/step4"
        element={
          <OnboardingRoute>
            <Step4Syllabus />
          </OnboardingRoute>
        }
      />
      <Route
        path="/onboarding/step5"
        element={
          <OnboardingRoute>
            <Step5Timetable />
          </OnboardingRoute>
        }
      />

      <Route path="/dashboard" element={<AppShellRoute><Dashboard /></AppShellRoute>} />
      <Route path="/planner" element={<AppShellRoute><Planner /></AppShellRoute>} />
      <Route path="/skills" element={<AppShellRoute><SkillGap /></AppShellRoute>} />
      <Route path="/career" element={<AppShellRoute><CareerRoadmap /></AppShellRoute>} />
      <Route path="/burnout" element={<AppShellRoute><BurnoutPredictor /></AppShellRoute>} />
      <Route path="/goals" element={<AppShellRoute><GoalAnalyzer /></AppShellRoute>} />
      <Route path="/academic" element={<AppShellRoute><AcademicData /></AppShellRoute>} />
      <Route path="/profile" element={<AppShellRoute><Profile /></AppShellRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

import { StudyProvider } from './context/StudyContext';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudyProvider>
          <AppRoutes />
        </StudyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
