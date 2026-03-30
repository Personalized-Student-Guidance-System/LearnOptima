import React, { useState, useEffect } from 'react';
import * as API from '../services/api';
import { Ic } from '../design/ui';
import { G, ICONS } from '../design/tokens';

export default function StudyStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prevStreak, setPrevStreak] = useState(null);
  const [showStreakNotif, setShowStreakNotif] = useState(false);
  const [streakMessage, setStreakMessage] = useState('');

  useEffect(() => {
    loadStats();
    // Refresh stats every 30 seconds for real-time updates
    const interval = setInterval(loadStats, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      setError(null);
      const res = await API.getStudyStats();
      
      // Check if streak increased
      if (prevStreak !== null && res.data.streak.currentStreak > prevStreak) {
        showStreakCelebration(res.data.streak.currentStreak);
      }
      
      setStats(res.data);
      setPrevStreak(res.data.streak.currentStreak);
    } catch (err) {
      // Silently fail for now - don't break the page
      console.warn('Study stats not available:', err?.response?.status);
      setStats(null);
      setError(err?.response?.status);
    } finally {
      setLoading(false);
    }
  };

  const showStreakCelebration = (newStreak) => {
    let message = `🔥 Streak: ${newStreak} days!`;
    
    // Special messages for milestone streaks
    if (newStreak === 7) message = '🎉 One week streak! Amazing consistency!';
    else if (newStreak === 14) message = '👑 Two weeks! You\'re unstoppable!';
    else if (newStreak === 30) message = '🏆 One month streak! Legendary!';
    else if (newStreak % 10 === 0) message = `🌟 ${newStreak} day milestone reached!`;
    else if (newStreak > prevStreak) message = `✨ Streak continues! Day ${newStreak}!`;
    
    setStreakMessage(message);
    setShowStreakNotif(true);
    setTimeout(() => setShowStreakNotif(false), 4000);
  };

  if (error === 401) {
    return <div style={{ fontSize: 12, color: G.text2 }}>Sync your profile to see study stats...</div>;
  }

  if (error) {
    return <div style={{ fontSize: 12, color: G.text2 }}>Study stats unavailable</div>;
  }

  if (loading || !stats) {
    return <div style={{ fontSize: 12, color: G.text2 }}>Loading study stats...</div>;
  }

  const { today, week, goalStatus, streak } = stats;

  return (
    <>
      {/* Toast notification for streak celebration */}
      {showStreakNotif && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: `linear-gradient(135deg, ${G.amber} 0%, ${G.orange || G.red} 100%)`,
          color: 'white',
          padding: '16px 24px',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          fontSize: 14,
          fontWeight: 600,
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out',
          lineHeight: 1.4
        }}>
          {streakMessage}
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
      {/* Today's Stats */}
      <div style={{ padding: '12px 14px', borderRadius: 6, background: G.blueBg, border: `1px solid ${G.blueBd}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: G.blue, marginBottom: 4 }}>TODAY</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: G.blue }}>{today.minutes}</div>
        <div style={{ fontSize: 10, color: G.text2 }}>mins ({today.sessions} sessions)</div>
      </div>

      {/* Week's Stats */}
      <div style={{ padding: '12px 14px', borderRadius: 6, background: G.purpleBg, border: `1px solid ${G.purpleBd}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: G.purple, marginBottom: 4 }}>THIS WEEK</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: G.purple }}>{week.hours}h</div>
        <div style={{ fontSize: 10, color: G.text2 }}>{week.minutes} mins average</div>
      </div>

      {/* Streak */}
      <div style={{ padding: '12px 14px', borderRadius: 6, background: G.amberBg, border: `1px solid ${G.amberBd}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: G.amber, marginBottom: 4 }}>🔥 STREAK</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: G.amber }}>{streak.currentStreak}</div>
        <div style={{ fontSize: 10, color: G.text2 }}>{streak.longestStreak} best</div>
      </div>

      {/* Daily Goal Progress */}
      <div style={{ padding: '12px 14px', borderRadius: 6, background: G.greenBg, border: `1px solid ${G.greenBd}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: G.green, marginBottom: 4 }}>DAILY GOAL</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: G.green }}>
          {goalStatus.todayProgress}%
        </div>
        <div style={{ fontSize: 10, color: G.text2, marginTop: 4 }}>
          <div style={{ width: '100%', height: 3, borderRadius: 1.5, background: G.bg2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${goalStatus.todayProgress}%`, background: G.green, transition: 'width 0.3s' }} />
          </div>
        </div>
        <div style={{ fontSize: 9, color: G.text3, marginTop: 2 }}>{Math.round(goalStatus.dailyGoal / 60)}h target</div>
      </div>

      {/* Weekly Goal Progress */}
      <div style={{ padding: '12px 14px', borderRadius: 6, background: G.redBg, border: `1px solid ${G.redBd}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: G.red, marginBottom: 4 }}>WEEKLY GOAL</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: G.red }}>
          {goalStatus.weekProgress}%
        </div>
        <div style={{ fontSize: 10, color: G.text2, marginTop: 4 }}>
          <div style={{ width: '100%', height: 3, borderRadius: 1.5, background: G.bg2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${goalStatus.weekProgress}%`, background: G.red, transition: 'width 0.3s' }} />
          </div>
        </div>
        <div style={{ fontSize: 9, color: G.text3, marginTop: 2 }}>{Math.round(goalStatus.weeklyGoal / 60)}h target</div>
      </div>
      </div>
    </>
  );
}
