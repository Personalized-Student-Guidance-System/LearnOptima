import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('sf_token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export const saveProfile = (data) => API.post('/onboarding/profile', data);
export const uploadResume = (formData) => API.post('/onboarding/resume', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const saveSkills = (data) => API.post('/onboarding/skills', data);
export const uploadSyllabus = (formData) => API.post('/onboarding/syllabus', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const uploadTimetable = (formData) => API.post('/onboarding/timetable', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const getProfile = () => API.get('/onboarding/profile');

export default {
  saveProfile,
  uploadResume,
  saveSkills,
  uploadSyllabus,
  uploadTimetable,
  getProfile,
};
