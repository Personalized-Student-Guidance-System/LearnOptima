const router = require('express').Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const DynamicRoadmap = require('../models/DynamicRoadmap');
const axios = require('axios');
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

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
    // Generate AI study plan logic
    const days = Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));
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
            endTime: `${9 + Math.min(hoursPerDay, 3)}:00`,
            category: 'study',
            priority: d < 2 ? 'high' : 'medium',
            aiGenerated: true
          });
        }
      }
    });
    const created = await Task.insertMany(tasks);
    res.json(created);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post('/sync-roadmap', auth, async (req, res) => {
  try {
    const { role } = req.body;
    
    // 1. Get Roadmap Phases
    const roadmap = await DynamicRoadmap.findOne({ role: role });
    if (!roadmap) return res.status(404).json({ message: 'Roadmap not found.' });
    
    // 2. Get existing tasks to avoid conflicts
    const today = new Date();
    today.setHours(0,0,0,0);
    const existingTasks = await Task.find({ user: req.user.id, date: { $gte: today } });
    
    // 3. User Prefs (for burnout model)
    const userPrefs = {
        max_study_hours: 4,
        sleep_hours: req.user.sleepHours || 7,
        academic_load: 5,
        deadline_pressure: 5
    };
    
    // 4. Send to Python Agent
    const mlRes = await axios.post(`${ML_URL}/reschedule`, {
        phases: roadmap.semesters,
        existing_tasks: existingTasks,
        user_prefs: userPrefs
    });
    
    if (mlRes.data && mlRes.data.tasks) {
        // Delete old AI generated roadmap tasks from today onwards to prevent duplicates
        await Task.deleteMany({ 
            user: req.user.id, 
            date: { $gte: today }, 
            aiGenerated: true,
            title: { $regex: /^Roadmap:/ }
        });
        
        // Save new tasks
        const newTasks = mlRes.data.tasks.map(t => ({
            ...t,
            user: req.user.id,
            date: new Date(t.date)
        }));
        
        const created = await Task.insertMany(newTasks);
        return res.json(created);
    }
    
    res.status(500).json({ message: 'ML agent failed to schedule.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;