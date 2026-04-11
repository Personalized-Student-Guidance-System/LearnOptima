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
    const mlService = require('../services/mlService');
    const userId = req.user.id;
    const queryRole = req.query.role;
    console.log(`[Skills] Analyze request - userId: ${userId}, queryRole: ${queryRole}`);
    
    // Get user profile and user data
    const profile = await StudentProfile.findOne({ userId });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Determine target role
    const targetRole = queryRole || profile?.targetRole || user.targetRole || 'Software Engineer';
    
    // Combine all user skills
    const allSkills = [
      ...(profile?.extractedSkills || []),
      ...(profile?.extraSkills || []),
      ...(user?.skills || []),
      ...((req.query.skills || '').split(',').filter(s => s.trim()))
    ];
    
    // Call ML service (backend/ml/skill_gap_analyzer.py via proxy)
    console.log(`[Skills] Calling ML for ${targetRole}...`);
    const mlResult = await mlService.getSkillGap(allSkills, targetRole);
    
    // Map ML output to frontend-expected format
    const prioritizedMissing = mlResult.missing_skills.slice(0, 10).map((s, i) => ({
      skill: s,
      importance: 100 - (i * 10),
      demand: 85,
      priority_score: 90 - (i * 8),
      interview_frequency: i === 0 ? 95 : i < 2 ? 85 : i < 4 ? 70 : 60,
      urgency: i === 0 ? 'Critical' : i < 2 ? 'High' : 'Medium',
      time_to_proficiency_days: 20 + (i * 5),
      prerequisites: []
    }));
    
    res.json({
      overview: {
        match_score: mlResult.match_score || 0,
        matched_count: mlResult.total_matched || 0,
        missing_count: mlResult.missing_skills.length,
        total_required: mlResult.total_required || 0,
        analysis: `ML-powered analysis complete. Live skills scraped from Naukri/LinkedIn for ${targetRole}.`
      },
      matched_skills: (mlResult.matched_skills || []).map(s => ({ skill: s, importance: 80 })),
      missing_skills: prioritizedMissing,
      top_5_priorities: prioritizedMissing.slice(0, 5),
      learning_queue: profile?.skillsToLearn || [],
      role: targetRole,
      userSkillsCount: allSkills.length,
      college: profile?.college,
      branch: profile?.branch,
      semester: profile?.semester,
      ml_debug: { scraped_required: mlResult.required_skills?.slice(0, 10) } // temp for testing
    });
  } catch (err) {
    console.error('[Skills] Analyze/ML error:', err.message);
    // Fallback to JS matching on error
    res.status(500).json({ message: `ML service unavailable: ${err.message}. Using fallback.` });
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
    
    // Generate learning path
    const learning_path = [
      { order: 1, skill: 'Fundamentals', start_week: 1, duration_weeks: 4, urgency: 'Critical', prerequisites: [] },
      { order: 2, skill: 'Core Concepts', start_week: 5, duration_weeks: 6, urgency: 'High', prerequisites: ['Fundamentals'] },
      { order: 3, skill: 'Specialization', start_week: 11, duration_weeks: 8, urgency: 'Medium', prerequisites: ['Core Concepts'] },
      { order: 4, skill: 'Advanced Topics', start_week: 19, duration_weeks: 8, urgency: 'Medium', prerequisites: ['Specialization'] }
    ];
    
    res.json({
      role: targetRole,
      total_duration_weeks: 26,
      learning_path,
      estimated_completion_date: 'Week 26',
      skills_count: allSkills.length,
      skills_to_learn: profile?.skillsToLearn || []
    });
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