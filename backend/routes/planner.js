const router = require('express').Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const axios = require('axios');

router.get('/', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { user: req.user.id };
    if (start && end) query.date = { $gte: new Date(start), $lte: new Date(end) };
    const tasks = await Task.find(query).sort('date startTime');
    res.json(tasks);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, user: req.user.id });
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body, { new: true }
    );
    res.json(task);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Task deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/ai-generate', auth, async (req, res) => {
  try {
    const { subjects, examDate, hoursPerDay } = req.body;
    console.log('AI Generate request:', { subjects, examDate, hoursPerDay, user: req.user.id });
    const days = Math.max(Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24)), 1);
    console.log('Calculated days:', days);
    const tasks = [];
    subjects.forEach((subject, i) => {
      for (let d = 0; d < days; d++) {
        const date = new Date();
        date.setDate(date.getDate() + d);
        if (d % subjects.length === i) {
          tasks.push({
            user: req.user.id,
            title: `Study: ${subject}`,
            date,
            startTime: '09:00',
            endTime: `${9 + hoursPerDay}:00`,
            category: 'study',
            priority: d < 2 ? 'high' : 'medium',
            aiGenerated: true
          });
        }
      }
    });
    console.log(`Created ${tasks.length} AI tasks`);
    const created = await Task.insertMany(tasks);
    res.json(created);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;