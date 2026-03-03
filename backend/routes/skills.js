const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

const roleSkillMap = {
  'Software Engineer': ['JavaScript', 'Python', 'Data Structures', 'Algorithms', 'Git', 'SQL', 'System Design'],
  'Data Scientist': ['Python', 'Machine Learning', 'Statistics', 'SQL', 'TensorFlow', 'Data Visualization', 'R'],
  'Product Manager': ['Agile', 'User Research', 'Data Analysis', 'Communication', 'Roadmapping', 'SQL'],
  'DevOps Engineer': ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'AWS', 'Terraform', 'Monitoring'],
  'Frontend Developer': ['React', 'JavaScript', 'CSS', 'HTML', 'TypeScript', 'Figma', 'Testing'],
  'Backend Developer': ['Node.js', 'Python', 'SQL', 'REST APIs', 'Microservices', 'Docker', 'Redis'],
  'ML Engineer': ['Python', 'TensorFlow', 'PyTorch', 'Statistics', 'MLOps', 'Docker', 'Data Pipelines'],
  'Cybersecurity Analyst': ['Networking', 'Linux', 'Python', 'Penetration Testing', 'SIEM', 'Cryptography']
};

router.get('/gap-analysis', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const targetRole = req.query.role || user.targetRole || 'Software Engineer';
    const requiredSkills = roleSkillMap[targetRole] || roleSkillMap['Software Engineer'];
    const userSkills = user.skills || [];
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    
    const matched = requiredSkills.filter(s => userSkillsLower.includes(s.toLowerCase()));
    const missing = requiredSkills.filter(s => !userSkillsLower.includes(s.toLowerCase()));
    const extra = userSkills.filter(s => !requiredSkills.map(r => r.toLowerCase()).includes(s.toLowerCase()));
    const matchScore = Math.round((matched.length / requiredSkills.length) * 100);

    res.json({ targetRole, requiredSkills, matched, missing, extra, matchScore, roles: Object.keys(roleSkillMap) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/update', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { skills: req.body.skills }, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;