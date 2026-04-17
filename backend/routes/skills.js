const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const { spawn } = require('child_process');
const path = require('path');

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

/**
 * GET /skills/analyze
 * Get detailed skill gap analysis for user's target role using ML
 */
router.get('/analyze', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const queryRole = req.query.role;
    console.log(`[Skills] Analyze request - userId: ${userId}, queryRole: ${queryRole}`);
    
    const profile = await StudentProfile.findOne({ userId });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    let targetRole = queryRole || profile?.targetRole || user.targetRole || 'Software Engineer';
    
    const allSkills = [
      ...(profile?.extractedSkills || []),
      ...(profile?.extraSkills || []),
      ...(user?.skills || []),
      ...((req.query.skills || '').split(',').filter(s => s.trim()))
    ];
    
    // Call Python ML API Agent for true gap analysis
    const axios = require('axios');
    const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
    try {
       const mlRes = await axios.post(`${ML_URL}/skill-gap`, {
          targetRole: targetRole.trim(),
          skills: allSkills
       }, { timeout: 90000 });
       
       const gapData = mlRes.data;
       
       // Pass the true ML data right to the frontend
       return res.json({
          ...gapData,
          userSkillsCount: allSkills.length,
          college: profile?.college,
          branch: profile?.branch,
          semester: profile?.semester
       });
    } catch(err) {
       console.error('[Skills] ML Error for gap analysis:', err.message);
       return res.status(500).json({ message: 'Failed to generate dynamic skill gap.' });
    }
  } catch (err) {
    console.error('[Skills] Analyze error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /skills/learning-path
 * Get recommended learning path with timeline
 */
router.get('/learning-path', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await StudentProfile.findOne({ userId });
    
    const allSkills = profile 
      ? [...(profile.extractedSkills || []), ...(profile.extraSkills || [])]
      : [];
    
    const targetRole = req.query.role || profile?.targetRole || 'Software Engineer';
    
    // Call Python ML API Agent to build dynamic path based on scraped job skill density
    const axios = require('axios');
    const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
    
    try {
        const mlRes = await axios.post(`${ML_URL}/learning-path`, {
            targetRole: targetRole.trim(),
            skills: allSkills
        }, { timeout: 90000 });
        
        return res.json({
            ...mlRes.data,
            skills_count: allSkills.length,
            skills_to_learn: profile?.skillsToLearn || []
        });
    } catch (err) {
        console.error('[Skills] ML Error for learning path:', err.message);
        return res.status(500).json({ message: 'Failed to generate dynamic learning path.' });
    }
  } catch (err) {
    console.error('[Skills] Learning path error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /skills/learning-queue
 * Add skill to learning queue
 */
router.put('/learning-queue', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { skill, action } = req.body;
    
    let profile = await StudentProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    if (action === 'add') {
      if (!profile.skillsToLearn) profile.skillsToLearn = [];
      if (!profile.skillsToLearn.includes(skill)) {
        profile.skillsToLearn.push(skill);
      }
    } else if (action === 'remove') {
      profile.skillsToLearn = (profile.skillsToLearn || []).filter(s => s !== skill);
    }
    
    await profile.save();
    
    console.log(`[Skills] Learning queue updated for ${userId}: ${action} ${skill}`);
    
    res.json({
      message: 'Learning queue updated',
      skillsToLearn: profile.skillsToLearn
    });
  } catch (err) {
    console.error('[Skills] Learning queue error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /skills/ai-recommendation
 * Get AI-powered personalized recommendation
 */
router.get('/ai-recommendation', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await StudentProfile.findOne({ userId });
    
    const allSkills = profile 
      ? [...(profile.extractedSkills || []), ...(profile.extraSkills || [])]
      : [];
    
    const targetRole = req.query.role || profile?.targetRole || 'Software Engineer';
    
    // Simplified agentic AI recommendation
    const recommendation = {
      analysis: `You're pursuing a ${targetRole} role with ${allSkills.length} documented skills. ${
        allSkills.length >= 8 ? "You have built a solid foundation. Focus on depth and specialization." :
        allSkills.length >= 5 ? "Good progress. Accelerate learning of critical skills." :
        "Build your fundamentals first, then move to specialization."
      }`,
      action_plan: [
        { week: '1-4', focus: 'Foundation', action: 'Master fundamentals of your target role' },
        { week: '5-8', focus: 'Core', action: 'Build core competencies' },
        { week: '9-16', focus: 'Application', action: 'Apply knowledge in projects' },
        { week: '17-24', focus: 'Specialization', action: 'Deepen expertise in specific areas' }
      ],
      strengths: allSkills.slice(0, 3),
      weaknesses: ['System Design Interviews', 'Large Scale Architecture', 'Production Debugging'],
      next_steps: [
        '1. Complete 1-2 side projects using core technologies',
        '2. Contribute to open-source projects',
        '3. Practice coding problems on coding platforms',
        '4. Build your portfolio and resume'
      ],
      estimated_time_to_ready_weeks: 26,
      role: targetRole
    };
    
    res.json(recommendation);
  } catch (err) {
    console.error('[Skills] AI recommendation error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;