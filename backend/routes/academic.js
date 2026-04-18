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

router.post('/bulk', auth, async (req, res) => {
  try {
    const { subjects, semester, sgpa, cgpa } = req.body;
    if (!subjects || !Array.isArray(subjects)) return res.status(400).json({ message: 'subjects array required' });
    
    // Convert semester to integer safely
    const semIndex = parseInt(semester, 10) || 1;
    
    const savedSubjects = [];
    for (let sub of subjects) {
      const subject = new Subject({ 
        name: sub.name, 
        code: sub.code || '',
        credits: sub.credits || 3, 
        grade: sub.grade,
        semester: semIndex,
        sgpa: parseFloat(sgpa) || null,
        cgpa: parseFloat(cgpa) || null,
        cie: sub.cie || 0,
        sliptest1: sub.sliptest1 || 0,
        sliptest2: sub.sliptest2 || 0,
        sliptest3: sub.sliptest3 || 0,
        assignment1: sub.assignment1 || 0,
        assignment2: sub.assignment2 || 0,
        user: req.user.id,
        attendance: sub.attendance || 80,
      });
      subject.calculateGrade && subject.calculateGrade();
      await subject.save();
      savedSubjects.push(subject);
    }
    
    // If a global CGPA was passed from the OCR parse, intelligently update the user's profile CGPA
    if (cgpa) {
       await User.findByIdAndUpdate(req.user.id, { cgpa: parseFloat(cgpa) });
       const StudentProfile = require('../models/StudentProfile');
       await StudentProfile.findOneAndUpdate({ userId: req.user.id }, { cgpa: parseFloat(cgpa), semester: semIndex });
    }

    res.status(201).json(savedSubjects);
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