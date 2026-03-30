const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  startTime: String,
  endTime: String,
  duration: { type: Number, default: 0 }, // in seconds
  category: { type: String, enum: ['study', 'assignment', 'project', 'exam', 'personal', 'other'], default: 'study' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  completed: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 }, // actual time spent in seconds
  aiGenerated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);