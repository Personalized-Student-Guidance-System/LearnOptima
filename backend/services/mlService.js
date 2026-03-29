const axios = require('axios');

const ML_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function parseResume(resumeUrl) {
  try {
    const { data } = await axios.post(`${ML_BASE_URL}/ml/parse-resume`, { resume_url: resumeUrl }, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  } catch (err) {
    
    if (process.env.NODE_ENV === 'development' && err.code !== 'ECONNREFUSED') {
      console.warn('ML parse-resume:', err.message);
    }
    return { skills: [], projects: [] };
  }
}

async function extractTimetable(imageUrl) {
  try {
    const { data } = await axios.post(`${ML_BASE_URL}/ml/extract-timetable`, { image_url: imageUrl }, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  } catch (err) {
    if (process.env.NODE_ENV === 'development' && err.code !== 'ECONNREFUSED') {
      console.warn('ML extract-timetable:', err.message);
    }
    return {};
  }
}

async function getSkillGap(studentSkills, careerGoal) {
  try {
    const { data } = await axios.post(`${ML_BASE_URL}/ml/skill-gap`, {
      student_skills: studentSkills,
      career_goal: careerGoal,
    }, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  } catch (err) {
    if (process.env.NODE_ENV === 'development' && err.code !== 'ECONNREFUSED') {
      console.warn('ML skill-gap:', err.message);
    }
    return { missing_skills: [] };
  }
}

module.exports = { parseResume, extractTimetable, getSkillGap };
