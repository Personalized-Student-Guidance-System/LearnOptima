import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login          from './pages/Login';
import Register       from './pages/Register';
import Dashboard      from './pages/Dashboard';
import Planner        from './pages/Planner';
import SkillGap       from './pages/SkillGap';
import CareerRoadmap  from './pages/CareerRoadmap';
import BurnoutPredictor from './pages/BurnoutPredictor';
import GoalAnalyzer   from './pages/GoalAnalyzer';
import AcademicData   from './pages/AcademicData';
import Profile        from './pages/Profile';
import './styles/globals.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5' }}>
      <div style={{ width: 20, height: 20, border: '2px solid #d0d0ca', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login"     element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register"  element={user ? <Navigate to="/dashboard" /> : <Register />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/planner"   element={<ProtectedRoute><Planner /></ProtectedRoute>} />
      <Route path="/skills"    element={<ProtectedRoute><SkillGap /></ProtectedRoute>} />
      <Route path="/career"    element={<ProtectedRoute><CareerRoadmap /></ProtectedRoute>} />
      <Route path="/burnout"   element={<ProtectedRoute><BurnoutPredictor /></ProtectedRoute>} />
      <Route path="/goals"     element={<ProtectedRoute><GoalAnalyzer /></ProtectedRoute>} />
      <Route path="/academic"  element={<ProtectedRoute><AcademicData /></ProtectedRoute>} />
      <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*"          element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}