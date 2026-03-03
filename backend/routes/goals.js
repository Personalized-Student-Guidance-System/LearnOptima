const router = require('express').Router();
const auth = require('../middleware/auth');
const Goal = require('../models/Goal');

router.get('/', auth, async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.id }).sort('-createdAt');
    res.json(goals);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const goal = await Goal.create({ ...req.body, user: req.user.id });
    res.status(201).json(goal);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body, { new: true }
    );
    res.json(goal);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Goal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Goal deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / 86400000) : null;
    const analysis = `Goal: "${goal.title}" is ${goal.progress}% complete. ${
      daysLeft ? `${daysLeft} days remaining. ` : ''
    }${goal.progress < 30 ? 'Focus needed — break this into daily micro-tasks.' :
       goal.progress < 70 ? 'Good momentum! Keep consistent daily effort.' :
       'Almost there — final push recommended!'}`;
    goal.aiAnalysis = analysis;
    await goal.save();
    res.json(goal);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;