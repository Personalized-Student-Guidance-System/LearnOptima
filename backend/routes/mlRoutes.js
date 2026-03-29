const router = require('express').Router();
const authMiddleware = require('../middleware/authMiddleware');
const mlService = require('../services/mlService');
const StudentProfile = require('../models/StudentProfile');

router.use(authMiddleware);

router.post('/parse-resume', async (req, res) => {
  try {
    const { resume_url } = req.body;
    if (!resume_url) return res.status(400).json({ message: 'resume_url required' });
    const data = await mlService.parseResume(resume_url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/extract-timetable', async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ message: 'image_url required' });
    const data = await mlService.extractTimetable(image_url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/skill-gap', async (req, res) => {
  try {
    const { student_skills, career_goal } = req.body;
    if (!career_goal) return res.status(400).json({ message: 'career_goal required' });
    const profile = await StudentProfile.findOne({ userId: req.user.id });
    const skills = student_skills || [
      ...(profile?.extractedSkills || []),
      ...(profile?.extraSkills || []),
    ];
    const data = await mlService.getSkillGap(skills, career_goal);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
