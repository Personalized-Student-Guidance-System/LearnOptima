const mongoose = require('mongoose');

const dynamicRoadmapSchema = new mongoose.Schema({
  role: { type: String, required: true }, // The target role (e.g., 'Data Scientist', 'UPSC Prep')
  semesters: [{
    sem: Number,
    title: String,
    duration: String,
    skills: [String],
    tasks: [String]
  }],
  source: { type: String, default: 'ai_agent' },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Create compound index for fast queries based on role
dynamicRoadmapSchema.index({ role: 1 }, { unique: true });

module.exports = mongoose.model('DynamicRoadmap', dynamicRoadmapSchema);
