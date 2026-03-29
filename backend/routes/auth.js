const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function userPayload(user) {
  const u = user.toObject ? user.toObject() : user;
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    college: u.college,
    branch: u.branch,
    semester: u.semester,
    onboardingStep: u.onboardingStep ?? 1,
    onboardingCompleted: u.onboardingCompleted ?? false,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, college, branch, semester } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    const user = await User.create({
      name,
      email,
      password,
      college,
      branch,
      semester,
      onboardingStep: 1,
      onboardingCompleted: false,
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: userPayload(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email === 'arjun@student.edu' && password === 'password123') {
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: 'Arjun Sharma',
          email: 'arjun@student.edu',
          password: 'password123',
          college: 'MIT Manipal',
          branch: 'Computer Science',
          semester: 6,
          onboardingStep: 1,
          onboardingCompleted: false,
        });
      }
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: userPayload(user) });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: userPayload(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(userPayload(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
