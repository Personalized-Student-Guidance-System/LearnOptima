const router = require('express').Router();
const authMiddleware = require('../middleware/authMiddleware');
const { resumeUpload, syllabusUpload, timetableUpload } = require('../middleware/uploadMiddleware');
const onboarding = require('../controllers/onboardingController');

function handleMulterError(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large. Maximum size is 50MB.' });
  }
  if (err) return next(err);
  next();
}

router.use(authMiddleware);

router.post('/profile', onboarding.profileStep);
router.post('/resume', resumeUpload, handleMulterError, onboarding.resumeStep);
router.post('/skills', onboarding.skillsStep);
router.post('/syllabus', syllabusUpload, handleMulterError, onboarding.syllabusStep);
router.post('/timetable', timetableUpload, handleMulterError, onboarding.timetableStep);
router.get('/profile', onboarding.getProfile);

module.exports = router;
