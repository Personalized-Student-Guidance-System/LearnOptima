// src/pages/CareerRoadmap.jsx  (or src/components/CareerRoadmap.jsx)
// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator — handles data fetching and state only.
// All visual concerns are delegated to sub-components.
//
//  Sub-components
//  ├── LiveJobsDropdown   – collapsible live job listings
//  ├── RoleSelector       – full-page role picker + inline role switcher
//  ├── ProgressBar        – overall progress
//  └── PhaseCard          – one semester / phase of the roadmap
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { G } from '../design/tokens';

import LiveJobsDropdown                       from '../components/career/LiveJobsDropdown';
import { RoleSelectorPage, RoleSwitcher,
         SkeletonRoleSelector }               from '../components/career/RoleSelector';
import ProgressBar                            from '../components/career/ProgressBar';
import PhaseCard, { SkeletonPhaseCard }       from '../components/career/PhaseCard';

// ── Inject shimmer + spin keyframes once ─────────────────────────────────────
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

// ── Default roles (used when profile API hasn't returned yet) ─────────────────
const DEFAULT_ROLES = [
  'Software Engineer', 'Data Scientist', 'DevOps Engineer',
  'Frontend Developer', 'Backend Developer', 'ML Engineer',
  'Full Stack Developer', 'Product Manager',
];

// ─────────────────────────────────────────────────────────────────────────────
export default function CareerRoadmap() {
  useGlobalAnimations();

  // ── State ──────────────────────────────────────────────────────────────────
  const [userProfile,     setUserProfile]     = useState(null);
  const [role,            setRole]            = useState(null);
  const [availableRoles,  setAvailableRoles]  = useState(DEFAULT_ROLES);
  const [data,            setData]            = useState(null);
  const [checked,         setChecked]         = useState({});
  const [saving,          setSaving]          = useState({});
  const [loading,         setLoading]         = useState(true);     // roadmap / initial
  const [loadingRoles,    setLoadingRoles]    = useState(false);    // jobs panel
  const [jobRoles,        setJobRoles]        = useState([]);

  // ── Load profile on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get('/profile');
        setUserProfile(res.data);
        if (res.data?.availableRoles?.length) setAvailableRoles(res.data.availableRoles);
        if (res.data?.targetRole) setRole(res.data.targetRole);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Fetch roadmap phases ──────────────────────────────────────────────────
  const fetchRoadmap = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await axios.get(`/career/personalized?role=${encodeURIComponent(r)}`);
      setData(res.data);
      if (res.data.checklistId) {
        const clRes = await axios.get(`/career/checklist/${res.data.checklistId}`);
        setChecked(clRes.data.items || {});
      }
    } catch (err) {
      console.error('Roadmap fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch live jobs ────────────────────────────────────────────────────────
  const fetchJobRoles = useCallback(async (r) => {
    setLoadingRoles(true);
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

  // ── Re-fetch when role changes ─────────────────────────────────────────────
  useEffect(() => {
    if (role) {
      fetchRoadmap(role);
      fetchJobRoles(role);
    }
  }, [role, fetchRoadmap, fetchJobRoles]);

  // ── Checklist toggle ───────────────────────────────────────────────────────
  const handleToggle = useCallback((phaseKey, item) => {
    const key = `${phaseKey}-${item}`;
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Persist asynchronously
      setSaving((s) => ({ ...s, [key]: true }));
      axios.post('/career/checklist/item', { role, itemKey: key, isChecked: next[key] })
        .catch((err) => console.error('Checklist save error:', err))
        .finally(() => setSaving((s) => ({ ...s, [key]: false })));
      return next;
    });
  }, [role]);

  // ── Role selection ─────────────────────────────────────────────────────────
  const handleSelectRole = useCallback((r) => {
    setRole(r);
    setData(null);      // clear stale roadmap immediately
    setJobRoles([]);
    axios.put('/profile', { targetRole: r, customRole: r })
      .catch((err) => console.error('Save role error:', err.response?.data || err.message));
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  // Support both old `semesters` key and new `phases` key from backend
  const phases    = data?.roadmap?.phases || data?.roadmap?.semesters || data?.phases || [];
  const allItems  = phases.flatMap((p) => p.tasks || []);
  const doneCount = Object.values(checked).filter(Boolean).length;

  const roles = data?.availableRoles?.length
    ? data.availableRoles
    : availableRoles;

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Full-page loading skeleton (initial profile fetch, no role yet)
  if (loading && !role) {
    return (
      <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 900 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ height: 28, width: 300, background: G.border2, borderRadius: 4, marginBottom: 8,
            background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ height: 16, width: 400, background: G.border2, borderRadius: 4,
            background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        </div>
        <SkeletonRoleSelector count={8} />
      </div>
    );
  }

  // 2. Role-selection screen
  if (!role) {
    return <RoleSelectorPage roles={roles} onSelect={handleSelectRole} />;
  }

  // 3. Main roadmap view
  return (
    <div className="page-enter" style={{ padding: '24px 28px', maxWidth: 1000 }}>

      {/* Header */}
      <div style={{
        marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Career Roadmap</h1>
          <p style={{ fontSize: 12, color: G.text2, marginTop: 2 }}>
            Your personalized path to become a <strong>{role}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setRole(null)}
          style={{ marginTop: 2 }}
        >
          Change Role
        </button>
      </div>

      {/* ── Live jobs – now a collapsible dropdown ── */}
      <LiveJobsDropdown role={role} jobs={jobRoles} loading={loadingRoles} />

      {/* ── Role switcher strip ── */}
      <RoleSwitcher roles={roles} currentRole={role} onSelect={handleSelectRole} />

      {/* ── Overall progress ── */}
      <ProgressBar doneCount={doneCount} totalCount={allItems.length} />

      {/* ── Roadmap phases ── */}
      {loading ? (
        <SkeletonPhaseCard count={6} />
      ) : phases.length === 0 ? (
        <EmptyRoadmap role={role} onRetry={() => fetchRoadmap(role)} data={data} />
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical timeline spine */}
          <div style={{
            position: 'absolute', left: 18, top: 28, bottom: 28,
            width: 1, background: G.border,
          }} />
          {phases.map((phase, pi) => (
            <PhaseCard
              key={pi}
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

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyRoadmap({ role, onRetry, data }) {
  const phases = data?.roadmap?.phases || data?.roadmap?.semesters || data?.phases || [];
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
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
          Reload Roadmap
        </button>
      </div>

      {/* Debug panel (dev convenience) */}
      <div className="card card-sm" style={{ background: G.bg2, padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: G.text3, marginBottom: 8 }}>DEBUG INFO</div>
        <pre style={{ fontSize: 10, color: G.text3, whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.4, margin: 0 }}>
{`Selected Role:     ${role || 'None'}
Data Loaded:       ${data ? 'Yes' : 'No'}
Roadmap Phases:    ${phases.length}
Available Roles:   ${data?.availableRoles?.join(', ') || 'Not loaded yet'}`}
        </pre>
      </div>
    </div>
  );
}