import axios from 'axios';
import io from 'socket.io-client';

const API = axios.create({
  baseURL: '/api',
});

// Token interceptor
API.interceptors.request.use((req) => {
  const token =
    localStorage.getItem('sf_token') || localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// Socket for StudyContext
export const connectStudySocket = (token, userId, onAgentUpdate) => {
  const socket = io('http://localhost:5000', { auth: { token } });
  socket.emit('join', userId);
  socket.on('agent-update', onAgentUpdate);
  return () => socket.close();
};

// Auth
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');

// Planner/Tasks
export const getTasks = (params) => API.get('/planner', { params });
export const createTask = (data) => API.post('/planner', data);
export const updateTask = (id, data) => API.put(`/planner/${id}`, data);
export const deleteTask = (id) => API.delete(`/planner/${id}`);
export const updateTaskStatus = (id, data) => API.post(`/planner/${id}/status`, data);
export const getPlannerConstants = () => API.get('/planner/preferences/constants');
export const savePlannerConstants = (data) => API.post('/planner/preferences/constants', data);
export const triggerDailyReplan = () => API.post('/planner/daily-replan');
export const getPlannerRisk = () => API.get('/planner/risk');
export const addAcademicCalendarEvents = (events) => API.post('/planner/calendar', { events });
export const syncDsaRoadmap = () => API.post('/planner/dsa/sync');
export const syncSyllabusConcepts = (limit = 12) => API.post('/planner/syllabus/sync', { limit });
export const generateTimetable = (days = 7) => API.post('/planner/timetable/generate', { days });
export const runCentralOrchestration = () => API.post('/planner/orchestrate-daily');
export const getOrchestrationRuns = (limit = 10) => API.get('/planner/orchestration-runs', { params: { limit } });

// Goals
export const getGoals = () => API.get('/goals');
export const createGoal = (data) => API.post('/goals', data);
export const updateGoal = (id, data) => API.put(`/goals/${id}`, data);
export const analyzeGoal = (id) => API.post(`/goals/${id}/analyze`);

// Burnout (incl. coach)
export const getBurnoutData = () => API.get('/burnout');
export const saveBurnoutData = (data) => API.post('/burnout/save-metrics', data);
export const predictBurnout = (data) => API.post('/burnout/predict', data);
export const dailyCheckin = (data) => API.post('/burnout/daily-checkin', data);
export const startBurnoutCoach = () => API.post('/burnout/coach/start');
export const sendBurnoutCoachMessage = (msg) => API.post('/burnout/coach/message', { message: msg });

// Skills
/** @param {string} role @param {boolean} [refresh] */
export const analyzeSkillGap = (role, refresh = false) =>
  API.get('/skills/analyze', {
    params: {
      role,
      ...(refresh ? { refresh: 'true' } : {}),
    },
  });
export const getSkillAIRecommendation = (role) => API.get('/skills/ai-recommendation', { params: { role } });

// Career
export const getCareerRoadmap = (params) => API.get('/career/personalized', { params });

// Study
export const getStudyStats = () => API.get('/study/stats');
export const startStudySession = (data = {}) => API.post('/study/session/start', data);
export const endStudySession = (data = {}) => API.post('/study/session/end', data);
export const updateStudySessionPage = (page) => API.post('/study/session/page', { page });
export const recordTaskTime = (taskId, timeSpent, sessionId) =>
  API.post('/study/task-time', { taskId, timeSpent, sessionId });

// Profile
export const updateProfile = (data) => API.put('/profile', data);
export const getProfile = () => API.get('/profile');
export const reparseProfileDocuments = () => API.post('/profile/reparse');
/** Upload resume or syllabus file → Cloudinary → auto-reparse */
export const uploadDocument = (file, type) => {
  const fd = new FormData();
  fd.append('file', file);
  return API.post(`/profile/upload-document?type=${type}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export default API;
