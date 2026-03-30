import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as API from '../services/api';

/**
 * Hook to track study sessions and time spent on app
 * Automatically:
 * - Starts session when app loads
 * - Tracks current page
 * - Ends session on unload
 * - Records activity
 */
export function useStudyTracking() {
  const sessionIdRef = useRef(null);
  const inactivityTimeoutRef = useRef(null);
  const location = useLocation();

  // Map route to category
  const getPageCategory = (pathname) => {
    if (pathname.includes('planner')) return 'planner';
    if (pathname.includes('skills')) return 'skills';
    if (pathname.includes('career')) return 'career';
    if (pathname.includes('burnout')) return 'burnout';
    if (pathname.includes('goals')) return 'goals';
    if (pathname.includes('academic')) return 'academic';
    if (pathname.includes('dashboard')) return 'dashboard';
    return 'navigation';
  };

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        const res = await API.startStudySession();
        sessionIdRef.current = res.data.sessionId;
        console.log('[Study] Session started:', res.data.sessionId);
      } catch (err) {
        // Silently fail if not authenticated yet
        if (err?.response?.status === 401) {
          console.log('[Study] Session not started - user not authenticated');
        } else {
          console.error('[Study] Failed to start session:', err?.message);
        }
      }
    };

    startSession();

    // Cleanup on unmount - end session
    const handleUnload = async () => {
      if (sessionIdRef.current) {
        try {
          await API.endStudySession();
          console.log('[Study] Session ended');
        } catch (err) {
          console.error('[Study] Failed to end session:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

  // Handle inactivity timeout (30 minutes)
  useEffect(() => {
    const resetInactivityTimer = () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }

      inactivityTimeoutRef.current = setTimeout(async () => {
        console.log('[Study] User inactive for 30 minutes, ending session');
        try {
          await API.endStudySession();
          sessionIdRef.current = null;
        } catch (err) {
          console.error('[Study] Failed to end inactive session:', err);
        }
      }, 30 * 60 * 1000); // 30 minutes
    };

    // Reset timer on user activity
    const handleActivity = () => {
      resetInactivityTimer();
    };

    document.addEventListener('click', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('scroll', handleActivity);

    resetInactivityTimer();

    return () => {
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('scroll', handleActivity);
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, []);

  // Track page changes
  useEffect(() => {
    const currentPage = getPageCategory(location.pathname);
    console.log('[Study] Page changed to:', currentPage);
    
    // Send page change to backend if session is active
    if (sessionIdRef.current) {
      API.updateStudySessionPage(currentPage).catch(err => {
        console.warn('[Study] Failed to update session page:', err?.message);
      });
    }
  }, [location.pathname]);

  return {
    sessionId: sessionIdRef.current,
    getCurrentPage: () => getPageCategory(location.pathname)
  };
}

/**
 * Hook to track time spent on a specific task
 */
export function useTaskTimer(taskId) {
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    console.log('[Study] Task timer started for task:', taskId);
  };

  const stopTimer = async () => {
    if (!startTimeRef.current) return 0;

    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000); // in seconds
    elapsedRef.current += elapsed;

    console.log('[Study] Task time recorded:', taskId, elapsedRef.current, 'seconds');

    try {
      await API.recordTaskTime(taskId, elapsed);
    } catch (err) {
      console.error('[Study] Failed to record task time:', err);
    }

    startTimeRef.current = null;
    return elapsedRef.current;
  };

  const getElapsed = () => elapsedRef.current;

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [taskId]);

  return {
    startTimer,
    stopTimer,
    getElapsed,
    elapsedSeconds: elapsedRef.current
  };
}
