import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const StudyContext = createContext();

export function StudyProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [agentNotifications, setAgentNotifications] = useState([]);
  const [studyStats, setStudyStats] = useState(null);

  useEffect(() => {
    if (!token || !user?.id) return;

    const newSocket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('[StudyContext] Connected to agent orchestrator');
      newSocket.emit('join', user.id.toString());
    });

    newSocket.on('agent-update', (data) => {
      console.log('[AgentUpdate]', data);
      setAgentNotifications(prev => [data, ...prev.slice(0, 4)]); // Last 5 only
      // Auto-refresh relevant data (planner, burnout)
      setStudyStats(prev => ({ ...prev, lastAgentAction: data }));
    });

    newSocket.on('disconnect', () => {
      console.log('[StudyContext] Disconnected');
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [token, user?.id]);

  const dismissNotification = (id) => {
    setAgentNotifications(prev => prev.filter(n => n.timestamp !== id));
  };

  // Fetch study stats on mount/interval
  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const res = await axios.get('/study/stats');
        setStudyStats(res.data);
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 300000); // 5min
    return () => clearInterval(interval);
  }, [user]);

  return (
    <StudyContext.Provider value={{
      socket,
      agentNotifications,
      studyStats,
      dismissNotification
    }}>
      {children}
    </StudyContext.Provider>
  );
}

export const useStudy = () => useContext(StudyContext);
