const mongoose = require('mongoose');

const PlannerRunLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  runDate: { type: Date, required: true, index: true },
  trigger: { type: String, enum: ['manual', 'scheduled', 'daily-checkin'], default: 'manual' },
  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  mode: { type: String, enum: ['strict', 'balanced', 'recovery'], default: 'balanced' },
  burnout: {
    level: { type: String, default: 'Moderate' },
    score: { type: Number, default: 50 },
    loadMultiplier: { type: Number, default: 1 },
  },
  decisions: {
    overdueShifted: { type: Number, default: 0 },
    capacityShifted: { type: Number, default: 0 },
    dsaTasksCreated: { type: Number, default: 0 },
    syllabusTasksCreated: { type: Number, default: 0 },
    cgpaBoostAdded: { type: Boolean, default: false },
  },
  reasons: { type: [String], default: [] },
  notes: { type: String, default: '' },
  error: { type: String, default: '' },
}, { timestamps: true });

PlannerRunLogSchema.index({ userId: 1, runDate: -1 });

module.exports = mongoose.model('PlannerRunLog', PlannerRunLogSchema);
