const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  semester: Number,
  credits: Number,
  marks: {
    internal1: Number,
    internal2: Number,
    external: Number
  },
  grade: String,
  gradePoints: Number,
  attendance: Number,
  createdAt: { type: Date, default: Date.now }
});

// Auto-calculate grade
subjectSchema.methods.calculateGrade = function() {
  const { internal1 = 0, internal2 = 0, external = 0 } = this.marks;
  const total = (internal1 + internal2) * 0.3 + external * 0.7;
  if (total >= 90) { this.grade = 'O'; this.gradePoints = 10; }
  else if (total >= 80) { this.grade = 'A+'; this.gradePoints = 9; }
  else if (total >= 70) { this.grade = 'A'; this.gradePoints = 8; }
  else if (total >= 60) { this.grade = 'B+'; this.gradePoints = 7; }
  else if (total >= 50) { this.grade = 'B'; this.gradePoints = 6; }
  else { this.grade = 'F'; this.gradePoints = 0; }
};

module.exports = mongoose.model('Subject', subjectSchema);