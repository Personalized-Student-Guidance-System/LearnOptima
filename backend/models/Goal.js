const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  category: { type: String, enum: ['academic', 'skill', 'career', 'personal'], default: 'academic' },
  deadline: Date,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  milestones: [{
    title: String,
    completed: { type: Boolean, default: false }
  }],
  aiAnalysis: String,
  aiDetails: {
    estTimeline: { type: String, default: 'TBD' },
    difficulty: { type: String, default: 'Standard' },
    skillsNeeded: { type: String, default: 'Role specifics' },
    courses: [String],
    plan: [String]
  },
  progressHistory: [{
    date: { type: Date, default: Date.now },
    progress: Number
  }],
  status: { type: String, enum: ['not_started', 'in_progress', 'completed', 'stuck'], default: 'not_started' },
  linkedSkill: { type: String, default: '' },
  source: { type: String, enum: ['manual', 'auto'], default: 'manual' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Goal', goalSchema);