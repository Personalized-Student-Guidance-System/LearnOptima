const mongoose = require('mongoose');

const AcademicEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // Event details
  title: { type: String, required: true }, // e.g., "Midterm Exam", "Diwali Holiday"
  type: { 
    type: String, 
    enum: ['Exam', 'Holiday', 'SlipTest', 'Seminar'], 
    required: true 
  },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date }, // For multi-day holidays
  color: String, // UI: red=exam, green=holiday
  
  // Recurring
  recurring: {
    frequency: { type: String, enum: ['monthly', 'weekly'] }, // e.g., monthly slip tests
    dayOfMonth: Number, // 15th of month
    until: Date // End recurring
  },
  
  notes: String // "No study today"
}, { 
  timestamps: true 
});

// Virtual for planner: Compute all instances
AcademicEventSchema.virtual('instances').get(function() {
  // Compute expanded dates; called in planner queries
});

AcademicEventSchema.index({ userId: 1, startDate: 1 });

module.exports = mongoose.model('AcademicEvent', AcademicEventSchema);
