const router = require('express').Router();
const auth = require('../middleware/auth');
const Goal = require('../models/Goal');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const { generateJson } = require('../services/geminiService');

router.get('/', auth, async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.id }).sort('-createdAt');
    res.json(goals);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const p = req.body.progress || 0;
    const goal = await Goal.create({ 
      ...req.body, 
      user: req.user.id,
      progressHistory: [{ progress: p, date: new Date() }]
    });
    res.status(201).json(goal);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const updatePayload = { ...req.body };
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });

    // Handle progress history snapshots
    if (updatePayload.progress !== undefined && updatePayload.progress !== goal.progress) {
       goal.progressHistory.push({ progress: updatePayload.progress, date: new Date() });
       goal.progress = updatePayload.progress;
    }
    
    // Merge other updates
    Object.assign(goal, updatePayload);
    
    // Skill Mapping auto-sync: When Goal is completed, inject Linked Skill to Skill Gap Profile
    if ((goal.status === 'completed' || goal.progress >= 100) && goal.linkedSkill) {
      goal.status = 'completed';
      const profile = await StudentProfile.findOne({ userId: req.user.id });
      if (profile && !profile.extraSkills?.includes(goal.linkedSkill)) {
        profile.extraSkills = [...(profile.extraSkills || []), goal.linkedSkill];
        await profile.save();
      }
    }

    await goal.save();
    
    res.json(goal);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Goal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Goal deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    
    // Fetch user profile for dynamic skill checking
    const profile = await StudentProfile.findOne({ userId: req.user.id }).catch(() => null);
    const userDoc = await User.findById(req.user.id).catch(() => null);
    
    const allUserSkills = [
      ...(profile?.extractedSkills || []),
      ...(profile?.extraSkills || []),
      ...(userDoc?.skills || [])
    ].map(s => s.toLowerCase().trim());
    
    // Call Gemini to analyze the goal
    const prompt = `
      You are an expert career and academic counselor. Analyze this user's learning/career goal.
      Goal Title: "${goal.title}"
      Category: "${goal.category}"
      Description/Context: "${goal.description || 'None provided'}"
      User's Current Skills: [${allUserSkills.join(', ') || 'No skills listed'}]

      Provide a realistic, actionable plan to achieve this goal. Break down what skills they need to learn, recommended courses, and a timeline. Look closely at the "User's Current Skills" and tailor the plan knowing their baseline.

      Return ONLY a JSON object with this exact structure:
      {
        "estTimeline": "String (e.g., '3-6 months', '1 Semester')",
        "difficulty": "String (e.g., 'Medium', 'Hard')",
        "skillsNeeded": ["Skill 1", "Skill 2", "Skill 3", "Skill 4"], // Essential core skills to reach this goal. Keep it to 4-8 key skills.
        "courses": ["Course String 1", "Course String 2"], // Recommended high-quality learning resources
        "plan": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"], // Actionable, sequential step-by-step plan
        "analysisMsg": "String (A short, personalized, encouraging message explaining the strategy and noting what they already know vs what they need to learn.)"
      }
    `;

    const result = await generateJson({ prompt });
    
    let { estTimeline, difficulty, skillsNeeded, courses, plan, analysisMsg } = result;

    if (!Array.isArray(skillsNeeded)) skillsNeeded = [];
    if (!Array.isArray(plan)) plan = [];
    if (!Array.isArray(courses)) courses = [];

    const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / 86400000) : null;
    if (daysLeft && daysLeft < 30) {
        analysisMsg += ` WARNING: You have an aggressive deadline of ${daysLeft} days. Increase your daily efforts.`;
    }

    // ─── CROSS-REFERENCE USER SKILLS ───
    const expectedSkillArray = skillsNeeded.map(s => s.trim().toLowerCase());
    const matchedSkills = expectedSkillArray.filter(reqSkill => 
        allUserSkills.some(userSkill => userSkill.includes(reqSkill) || reqSkill.includes(userSkill))
    );
    const missingSkills = expectedSkillArray.filter(reqSkill => !matchedSkills.includes(reqSkill));

    // Calculate smart progress % based on matched skills + tasks completed out of total plan steps
    const skillProgress = expectedSkillArray.length > 0 ? (matchedSkills.length / expectedSkillArray.length) : 0;
    
    // Auto-update action plan to reflect current profile completion
    plan = plan.map(step => {
        const stepLower = step.toLowerCase();
        const coversMatchedSkill = matchedSkills.some(ms => stepLower.includes(ms));
        if (coversMatchedSkill) {
             return `✅ [COMPLETED via Profile] ${step}`;
        }
        return step;
    });

    if (matchedSkills.length > 0) {
        analysisMsg += ` \n✨ Good news: Based on your Profile, you already possess ${matchedSkills.length} of ${expectedSkillArray.length} key competencies (${matchedSkills.map(s=>s.toUpperCase()).join(', ')}).`;
        if (missingSkills.length > 0) {
             analysisMsg += ` Your clear next steps are to master: ${missingSkills.map(s=>s.toUpperCase()).join(', ')}.`;
        } else {
             analysisMsg += ` You literally have all the core skills for this. Time to start executing!`;
        }
    } else {
        if (expectedSkillArray.length > 0) {
            analysisMsg += ` \n📈 You are starting fresh. Focus strictly on ${expectedSkillArray[0]?.toUpperCase()} first. Add it to your learning queue directly from your Skill Gap page.`;
        }
    }

    // Blend skill progress heavily into the goal's actual stored progress
    const calculatedProgress = Math.min(100, Math.max(goal.progress || 0, Math.floor(skillProgress * 100)));
    goal.progress = calculatedProgress;
    if (goal.progress >= 100) goal.status = 'completed';

    goal.progressHistory.push({ progress: calculatedProgress, date: new Date() });

    goal.aiAnalysis = analysisMsg;
    // Map the plan directly into trackable milestones
    goal.milestones = plan.map(item => ({
       title: item.replace('✅ [COMPLETED via Profile] ', ''),
       completed: item.startsWith('✅')
    }));

    goal.aiDetails = {
      estTimeline: estTimeline || 'TBD',
      difficulty: difficulty || 'TBD',
      skillsNeeded: skillsNeeded.join(', '),
      matchedSkills: matchedSkills,
      missingSkills: missingSkills,
      courses,
      plan
    };
    
    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error('Goal AI Analysis Error:', err);
    res.status(500).json({ message: 'Goal analysis failed. Ensure AI services are available.' });
  }
});

module.exports = router;