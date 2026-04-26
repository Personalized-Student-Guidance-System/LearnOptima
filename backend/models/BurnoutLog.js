const mongoose = require('mongoose');

const BurnoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  
  // Daily inputs
  studyHours: { type: Number, min: 0, max: 24 },
  sleepHours: { type: Number, min: 0, max: 24 },
  performanceRating: { type: String, enum: ['Poor', 'Fair', 'Good', 'Excellent'] },
  performanceNotes: { type: String }, // "Why low perf → AI input"
  
  // Undone tasks (top 3 overdue)
  undoneTasks: [{
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    title: String,
    reasonCategory: { type: String },
    reasonText: String
  }],
  
  // Computed
  burnoutScore: Number, // 0-100 from ML
  burnoutLevel: { type: String, enum: ['Low', 'Moderate', 'High', 'Critical'] },
  agentAction: String, // e.g., "Rescheduled 2 tasks", "Coach intervention"
  plannerDecision: {
    mode: { type: String },
    loadMultiplier: { type: Number },
    explanation: { type: String },
  },
  
  // Readiness integration
  targetRole: String,
  readinessScore: Number
}, { 
  timestamps: true 
});

// Index for queries
BurnoutLogSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('BurnoutLog', BurnoutLogSchema);
