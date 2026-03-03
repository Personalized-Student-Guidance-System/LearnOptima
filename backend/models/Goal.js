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
  status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Goal', goalSchema);