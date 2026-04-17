// models/StudentProfile.js
const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  goal:       { type: String, required: true },
  targetYear: { type: Number },
}, { _id: false });

// Structured project extracted from resume
const extractedProjectSchema = new mongoose.Schema({
  title:       { type: String },
  description: { type: String },
  techStack:   [String],
}, { _id: false });

const studentProfileSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // Basic info
  branch:     { type: String },
  semester:   { type: Number },
  college:    { type: String },
  targetRole: { type: String }, // Primary/Active Role
  targetRoles: [String],        // All Selected Roles
  customRole: { type: String },
  bio:        { type: String },
  cgpa:       { type: Number },

  goals:     [goalSchema],
  interests: [String],

  // Resume
  resumeUrl:    { type: String },
  resumeParsed: { type: mongoose.Schema.Types.Mixed },

  // Parsed arrays from resume (clean strings)
  extractedSkills:        [String],
  extractedEducation:     [String],
  extractedExperience:    [String],
  extractedCertifications:[String],

  // Structured project objects from resume parser
  extractedProjects: [extractedProjectSchema],

  // User-managed fields
  extraSkills:    [String],   // user-added skills
  skillsToLearn:  [String],   // skills user wants to learn
  projects:       [String],   // legacy / user-added project notes

  // Syllabus
  syllabusUrl:      { type: String },
  syllabusSubjects: [String],
  syllabusStructure:{ type: mongoose.Schema.Types.Mixed, default: {} },

  // Timetable
  timetableUrl: { type: String },
  timetable:    { type: mongoose.Schema.Types.Mixed },

  // Wellbeing
  burnoutMetrics: {
    studyHours:       { type: Number, min: 0 },
    sleepHours:       { type: Number, min: 0 },
    deadlinePressure: { type: Number, min: 0, max: 10 },
    academicLoad:     { type: Number, min: 0, max: 10 },
    exerciseTime:     { type: Number, min: 0 },
    socialTime:       { type: Number, min: 0 },
  },
}, { timestamps: true, collection: 'studentprofiles' });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);