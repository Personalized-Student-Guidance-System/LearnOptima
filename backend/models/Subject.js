const mongoose = require('mongoose');

const gradeMap = {
  'S': 10,
  'A': 9,
  'B': 8,
  'C': 7,
  'D': 6,
  'E': 5,
  'F': 0
};

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String }, // Subject code (e.g. 22MTC04)
  credits: { type: Number, default: 3 },
  grade: { type: String, required: true },
  gradePoints: { type: Number },
  semester: { type: Number, default: 1 },
  
  // Historical data
  sgpa: { type: Number },
  cgpa: { type: Number },
  
  // Manual metrics entered by the user
  cie: { type: Number, default: 0 },
  sliptest1: { type: Number, default: 0 },
  sliptest2: { type: Number, default: 0 },
  sliptest3: { type: Number, default: 0 },
  assignment1: { type: Number, default: 0 },
  assignment2: { type: Number, default: 0 },
  
  attendance: { type: Number, default: 80 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
 
subjectSchema.pre('save', function (next) {
  if (this.grade) {
    this.gradePoints = gradeMap[this.grade.toUpperCase()] || 0;
  }
  next();
});

module.exports = mongoose.model('Subject', subjectSchema);