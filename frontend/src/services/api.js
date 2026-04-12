import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

// Add token to requests (use 'sf_token' to match AuthContext)
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('sf_token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// Auth
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');

// Planner/Tasks
export const getTasks = (params) => API.get('/planner', { params });
export const createTask = (data) => API.post('/planner', data);
export const updateTask = (id, data) => API.put(`/planner/${id}`, data);
export const deleteTask = (id) => API.delete(`/planner/${id}`);
export const generateAIPLan = (data) => API.post('/planner/ai-generate', data);

// Goals
export const getGoals = () => API.get('/goals');
export const createGoal = (data) => API.post('/goals', data);
export const updateGoal = (id, data) => API.put(`/goals/${id}`, data);
export const deleteGoal = (id) => API.delete(`/goals/${id}`);
export const analyzeGoal = (id) => API.post(`/goals/${id}/analyze`);

// Academic
export const getSubjects = () => API.get('/academic');
export const createSubject = (data) => API.post('/academic', data);
export const updateSubject = (id, data) => API.put(`/academic/${id}`, data);
export const deleteSubject = (id) => API.delete(`/academic/${id}`);

// Burnout
export const getBurnoutData = () => API.get('/burnout');
export const saveBurnoutData = (data) => API.post('/burnout/save-metrics', data);
export const predictBurnout = (data) => API.post('/burnout/predict', data);
export const startBurnoutCoach = () => API.post('/burnout/coach/start', {});
export const sendBurnoutCoachMessage = (message) => API.post('/burnout/coach/message', { message });

// Skills
export const getSkills = () => API.get('/skills');
export const updateSkills = (data) => API.post('/skills', data);
export const analyzeSkillGap = (role) => API.get('/skills/analyze', { params: { role } });
export const getSkillLearningPath = (role) => API.get('/skills/learning-path', { params: { role } });
export const getSkillAIRecommendation = (role) => API.get('/skills/ai-recommendation', { params: { role } });
export const updateSkillLearningQueue = (skill, action) => API.put('/skills/learning-queue', { skill, action });

// Career
export const getCareerRoadmap = () => API.get('/career');
export const updateCareerProgress = (data) => API.post('/career', data);

// Study Time Tracking
export const startStudySession = () => API.post('/study/session/start');
export const endStudySession = () => API.post('/study/session/end');
export const recordTaskTime = (taskId, timeSpent) => API.post('/study/task-time', { taskId, timeSpent });
export const updateStudySessionPage = (page) => API.post('/study/session/page', { page });
export const getStudyStats = () => API.get('/study/stats');
export const getStudyHistory = () => API.get('/study/history');

// Profile
export const updateProfile = (data) => API.put('/profile', data);

export default API;
