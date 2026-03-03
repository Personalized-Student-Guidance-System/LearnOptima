const router = require('express').Router();
const auth = require('../middleware/auth');
const Subject = require('../models/Subject');
const User = require('../models/User');

router.get('/', auth, async (req, res) => {
  try {
    const subjects = await Subject.find({ user: req.user.id }).sort('semester');
    res.json(subjects);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const subject = new Subject({ ...req.body, user: req.user.id });
    subject.calculateGrade();
    await subject.save();
    res.status(201).json(subject);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.id, user: req.user.id });
    Object.assign(subject, req.body);
    subject.calculateGrade();
    await subject.save();
    res.json(subject);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Subject.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Subject deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/cgpa', auth, async (req, res) => {
  try {
    const subjects = await Subject.find({ user: req.user.id, gradePoints: { $exists: true } });
    if (!subjects.length) return res.json({ cgpa: 0 });
    const totalCredits = subjects.reduce((sum, s) => sum + (s.credits || 0), 0);
    const weightedSum = subjects.reduce((sum, s) => sum + (s.gradePoints || 0) * (s.credits || 0), 0);
    const cgpa = totalCredits ? (weightedSum / totalCredits).toFixed(2) : 0;
    await User.findByIdAndUpdate(req.user.id, { cgpa });
    res.json({ cgpa, totalCredits, subjects: subjects.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;