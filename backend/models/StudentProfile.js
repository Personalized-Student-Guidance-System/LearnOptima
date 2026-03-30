// models/StudentProfile.js
const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  goal: { type: String, required: true },
  targetYear: { type: Number },
}, { _id: false });

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  branch: { type: String },
  semester: { type: Number },
  college: { type: String },
  targetRole: { type: String },
  bio: { type: String },
  cgpa: { type: Number },
  goals: [goalSchema],
  interests: [String],
  resumeUrl: { type: String },
  resumeParsed: { type: mongoose.Schema.Types.Mixed },
  extractedSkills: [String],
  extractedEducation: [String],
  extractedExperience: [String],
  extractedCertifications: [String],
  extraSkills: [String],
  skillsToLearn: [String],  // New: Skills user wants to prioritize learning
  projects: [String],
  syllabusUrl: { type: String },
  syllabusSubjects: [String],
  syllabusStructure: { type: mongoose.Schema.Types.Mixed, default: {} },
  timetableUrl: { type: String },
  timetable: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'studentprofiles' });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);