const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');

function toUserResponse(user, profile = null) {
  const u = user.toObject ? user.toObject() : user;
  const out = {
    id: u._id,
    name: u.name,
    email: u.email,
    onboardingCompleted: u.onboardingCompleted ?? false,
    onboardingStep: u.onboardingStep ?? 1,
  };
  if (profile && u.onboardingCompleted) {
    out.branch = profile.branch;
    out.semester = profile.semester;
  }
  return out;
}

async function signup(req, res) {
  try {
    const { name, email, password, college, branch, semester } = req.body;
    const payload = {
      name,
      email,
      password,
      college,
      branch,
      semester,
      onboardingStep: 1,
      onboardingCompleted: false
    };
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    const user = await User.create(payload);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: toUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: toUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const profile = await StudentProfile.findOne({ userId: req.user.id });
    res.json(toUserResponse(user, profile));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { signup, login, me };
