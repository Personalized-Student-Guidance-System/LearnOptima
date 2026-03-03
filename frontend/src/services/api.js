import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Add token to requests
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
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
export const saveBurnoutData = (data) => API.post('/burnout', data);

// Skills
export const getSkills = () => API.get('/skills');
export const updateSkills = (data) => API.post('/skills', data);
export const analyzeSkillGap = (data) => API.post('/skills/analyze', data);

// Career
export const getCareerRoadmap = () => API.get('/career');
export const updateCareerProgress = (data) => API.post('/career', data);

// Profile
export const updateProfile = (data) => API.put('/profile', data);

export default API;
