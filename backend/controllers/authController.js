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
    // Prioritize StudentProfile.targetRole (where existing users have their data), fallback to User.targetRole
    targetRole: (profile?.targetRole) || u.targetRole || null,
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
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
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
    // CRITICAL: Fetch profile for existing users to get targetRole
    const profile = await StudentProfile.findOne({ userId: user._id });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const userResponse = toUserResponse(user, profile);
    console.log(`[Auth] Login: user=${user._id}, targetRole=${userResponse.targetRole}`);
    res.json({ token, user: userResponse });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
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
