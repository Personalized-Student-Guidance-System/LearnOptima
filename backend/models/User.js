const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  college: String,
  branch: String,
  semester: Number,
  cgpa: Number,
  skills: [String],
  interests: [String],
  targetRole: String,
  dailyGoalMinutes: { type: Number, default: 120 }, // 2 hours default
  weeklyGoalMinutes: { type: Number, default: 840 }, // 14 hours default
  onboardingStep: { type: Number, default: 1 },
  onboardingCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(pwd) {
  return bcrypt.compare(pwd, this.password);
};

module.exports = mongoose.model('User', userSchema);