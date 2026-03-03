const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, college, branch, semester } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    const user = await User.create({ name, email, password, college, branch, semester });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name, email, college, branch, semester } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Auto-create demo user if demo credentials used
    if (email === 'arjun@student.edu' && password === 'password123') {
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: 'Arjun Sharma',
          email: 'arjun@student.edu',
          password: 'password123',
          college: 'MIT Manipal',
          branch: 'Computer Science',
          semester: 6
        });
      }
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: user._id, name: user.name, email, college: user.college, branch: user.branch } });
    }
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email, college: user.college, branch: user.branch } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;