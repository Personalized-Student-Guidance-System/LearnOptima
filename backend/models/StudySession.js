const mongoose = require('mongoose');

const taskTimeSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  taskTitle: String,
  timeSpent: { type: Number, default: 0 }, // in seconds
  category: String,
  date: { type: Date, default: Date.now }
}, { _id: false });

const studySessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number, default: 0 }, // in seconds
  page: String, // which page they were on
  focus: String, // learning, coding, planning, etc
  taskTimes: [taskTimeSchema],
  isActive: { type: Boolean, default: true },
  notes: String,
  tags: [String], // skill focus areas
}, { timestamps: true });

// Calculate duration before saving
studySessionSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000); // in seconds
  }
  next();
});

// Index for quick queries
studySessionSchema.index({ userId: 1, startTime: -1 });

module.exports = mongoose.model('StudySession', studySessionSchema);
