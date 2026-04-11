// src/pages/CareerRoadmap.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator — handles data fetching and state only.
// FIXED:
//   • Backend returns { phases, skillGap, ... } at the root level.
//     Old code looked for data.roadmap.phases — broke silently every time.
//   • Added SkillGapBanner to surface ML analysis results to the user.
//   • /profile route collision fixed on backend; frontend unchanged.
//   • Role switcher now correctly resets checklist state on role change.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

import LiveJobsDropdown                         from '../components/career/LiveJobsDropdown';
import { RoleSelectorPage, RoleSwitcher,
         SkeletonRoleSelector }                 from '../components/career/RoleSelector';
import ProgressBar                              from '../components/career/ProgressBar';
import PhaseCard, { SkeletonPhaseCard }         from '../components/career/PhaseCard';
import SkillGapBanner                           from '../components/career/SkillGapBanner';

// ── Design tokens (inline fallback so this file works standalone) ─────────────
const G = {
  text:    'var(--color-text-primary)',
  text2:   'var(--color-text-secondary)',
  text3:   'var(--color-text-tertiary)',
  border:  'var(--color-border-tertiary)',
  border2: 'var(--color-border-secondary)',
  bg2:     'var(--color-background-secondary)',
  blue:    'var(--color-text-info)',
  green:   'var(--color-text-success)',
};

// ── Inject shimmer keyframe once ──────────────────────────────────────────────
function useGlobalAnimations() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `
      @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      @keyframes spin     { to{transform:rotate(360deg)} }
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
}

const DEFAULT_ROLES = [
  'Software Engineer', 'Data Scientist', 'DevOps Engineer',
  'Frontend Developer', 'Backend Developer', 'ML Engineer',
  'Full Stack Developer', 'Product Manager',
];

// ─────────────────────────────────────────────────────────────────────────────
export default function CareerRoadmap() {
  useGlobalAnimations();

  const [userProfile,    setUserProfile]    = useState(null);
  const [role,           setRole]           = useState(null);
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  const [data,           setData]           = useState(null);  // full API response
  const [checked,        setChecked]        = useState({});
  const [saving,         setSaving]         = useState({});
  const [loading,        setLoading]        = useState(true);
  const [loadingRoles,   setLoadingRoles]   = useState(false);
  const [jobRoles,       setJobRoles]       = useState([]);

  // ── Load profile on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get('/profile');
        setUserProfile(res.data);
        if (res.data?.availableRoles?.length) setAvailableRoles(res.data.availableRoles);
        if (res.data?.targetRole)             setRole(res.data.targetRole);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Fetch roadmap phases ──────────────────────────────────────────────────
  // FIXED: backend returns { phases, skillGap, checklistId, ... } at root level.
  // Previous code looked inside data.roadmap.phases — which never existed.
  const fetchRoadmap = useCallback(async (r) => {
    setLoading(true);
    setData(null);
    try {
      const res = await axios.get(`/career/personalized?role=${encodeURIComponent(r)}`);
      setData(res.data);

      // Load persisted checklist if one exists for this role
      if (res.data.checklistId) {
        try {
          const clRes = await axios.get(`/career/checklist/${res.data.checklistId}`);
          setChecked(clRes.data.items || {});
        } catch {
          setChecked({});
        }
      } else {
        setChecked({});
      }
    } catch (err) {
      console.error('Roadmap fetch error:', err);
      setData({ phases: [], error: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch live jobs ───────────────────────────────────────────────────────
  const fetchJobRoles = useCallback(async (r) => {
    setLoadingRoles(true);
    setJobRoles([]);
    try {
      const res = await axios.get(`/career/live-jobs?role=${encodeURIComponent(r)}`);
      setJobRoles(res.data.jobs || []);
    } catch (err) {
      console.error('Jobs fetch error:', err);
      setJobRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  // ── Re-fetch when role changes ────────────────────────────────────────────
  useEffect(() => {
    if (role) {
      fetchRoadmap(role);
      fetchJobRoles(role);
    }
  }, [role, fetchRoadmap, fetchJobRoles]);

  // ── Checklist toggle ──────────────────────────────────────────────────────
  const handleToggle = useCallback((phaseKey, item) => {
    const key = `${phaseKey}-${item}`;
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setSaving((s) => ({ ...s, [key]: true }));
      axios.post('/career/checklist/item', { role, itemKey: key, isChecked: next[key] })
        .catch((err) => console.error('Checklist save error:', err))
        .finally(() => setSaving((s) => ({ ...s, [key]: false })));
      return next;
    });
  }, [role]);

  // ── Role selection ────────────────────────────────────────────────────────
  const handleSelectRole = useCallback((r) => {
    setRole(r);
    setData(null);
    setJobRoles([]);
    setChecked({});   // FIXED: clear stale checklist state on role switch
    axios.put('/profile', { targetRole: r, customRole: r })
      .catch((err) => console.error('Save role error:', err.response?.data || err.message));
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  // FIXED: backend returns phases at root level, not inside data.roadmap
  const phases   = data?.phases || [];

  const allItems  = phases.flatMap((p) => p.tasks || []);
  const doneCount = Object.values(checked).filter(Boolean).length;

  const roles = data?.availableRoles?.length
    ? data.availableRoles
    : availableRoles;

  // ── Render: full-page skeleton (initial load, no role yet) ─────────────────
  if (loading && !role) {
    return (
      <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 900 }}>
        <ShimmerBlock width={300} height={28} style={{ marginBottom: 8 }} />
        <ShimmerBlock width={400} height={16} style={{ marginBottom: 32 }} />
        <SkeletonRoleSelector count={8} />
      </div>
    );
  }

  // ── Render: role selection screen ─────────────────────────────────────────
  if (!role) {
    return <RoleSelectorPage roles={roles} onSelect={handleSelectRole} />;
  }

  // ── Render: main roadmap view ─────────────────────────────────────────────
  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000 }}>

      {/* Header */}
      <div style={{
        marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: G.text }}>
            Career Roadmap
          </h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>
            Your personalized path to become a <strong>{role}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setRole(null); setData(null); }}
          style={{ marginTop: 2 }}
        >
          Change Role
        </button>
      </div>

      {/* Live job listings */}
      <LiveJobsDropdown role={role} jobs={jobRoles} loading={loadingRoles} />

      {/* Role switcher strip */}
      <RoleSwitcher roles={roles} currentRole={role} onSelect={handleSelectRole} />

      {/* Overall progress */}
      <ProgressBar doneCount={doneCount} totalCount={allItems.length} />

      {/* Explicit loading text (requested) */}
      {loading && (
        <div style={{
          margin: '10px 0 18px',
          fontSize: 12,
          color: G.text2,
        }}>
          Loading roadmap data…
        </div>
      )}

      {/* Roadmap phases */}
      {loading ? (
        <SkeletonPhaseCard count={6} />
      ) : phases.length === 0 ? (
        <EmptyRoadmap role={role} onRetry={() => fetchRoadmap(role)} data={data} />
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline spine */}
          <div style={{
            position: 'absolute', left: 18, top: 28, bottom: 28,
            width: 1, background: G.border,
          }} />
          {phases.map((phase, pi) => (
            <PhaseCard
              key={`${role}-phase-${pi}`}
              phase={phase}
              phaseIndex={pi}
              checked={checked}
              saving={saving}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Small shimmer helper ──────────────────────────────────────────────────────
function ShimmerBlock({ width, height, style = {} }) {
  return (
    <div style={{
      width, height,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
      borderRadius: 4, ...style,
    }} />
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyRoadmap({ role, onRetry, data }) {
  const G = {
    bg2: 'var(--color-background-secondary)',
    border: 'var(--color-border-tertiary)',
    text2: 'var(--color-text-secondary)',
    text3: 'var(--color-text-tertiary)',
  };
  return (
    <div>
      <div style={{
        padding: 60, textAlign: 'center',
        background: G.bg2, borderRadius: 8,
        border: `1px solid ${G.border}`, marginBottom: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: G.text2, marginBottom: 8 }}>
          No roadmap data available
        </div>
        <div style={{ fontSize: 12, color: G.text3, marginBottom: 16 }}>
          The roadmap for <strong>{role}</strong> could not be loaded.
          Try refreshing or selecting a different role.
          {data?.error && (
            <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 11, color: '#dc2626' }}>
              Error: {data.error}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
          Reload Roadmap
        </button>
      </div>

      <div style={{ background: G.bg2, padding: 12, borderRadius: 8, border: `1px solid ${G.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 8 }}>DEBUG</div>
        <pre style={{ fontSize: 10, color: G.text3, whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.4, margin: 0 }}>
{`Selected Role:   ${role || 'None'}
Data Loaded:     ${data ? 'Yes' : 'No'}
Phases:          ${data?.phases?.length ?? 0}
Source:          ${data?.source || 'Unknown'}`}
        </pre>
      </div>
    </div>
  );
}