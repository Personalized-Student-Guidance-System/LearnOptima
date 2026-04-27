const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const { uploadToCloudinary } = require('../middleware/uploadMiddleware'); // assume exists or create later
const mlService = require('../services/mlService');
const { parseResumeBuffer } = require('../services/nlpResumeParser');
const syllabusParser = require('../services/syllabusParser');

const TOTAL_STEPS = 5;
const log = (step, msg) => console.log(`[Onboarding] ${step} ${msg}`);

async function getOrCreateProfile(userId) {
  let profile = await StudentProfile.findOne({ userId });
  if (!profile) {
    profile = new StudentProfile({ userId });
    await profile.save();
    log('DB', `StudentProfile created for user ${userId}`);
  }
  return profile;
}

async function advanceStep(userId, step) {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      onboardingStep: step,
      ...(step > TOTAL_STEPS ? { onboardingCompleted: true } : {}),
    },
    { new: true },
  );
  log('DB', `User ${userId} onboardingStep=${user.onboardingStep} onboardingCompleted=${user.onboardingCompleted}`);
  return user;
}

async function profileStep(req, res) {
  try {
    log('Step1', 'Profile & goals — start');
    const { branch, semester, goal, targetYear, interests, targetRole } = req.body;
    if (!targetRole || !String(targetRole).trim()) {
      return res.status(400).json({ message: 'Target role is required. Please select a target role to continue.' });
    }
    let interestsArr = [];
    if (Array.isArray(interests)) interestsArr = interests;
    else if (typeof interests === 'string') {
      try {
        const parsed = JSON.parse(interests);
        interestsArr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      } catch {
        interestsArr = interests.trim() ? [interests.trim()] : [];
      }
    } else if (interests) interestsArr = [interests];

    const profile = await getOrCreateProfile(req.user.id);
    const goals = goal ? [{ goal, targetYear: targetYear ? Number(targetYear) : undefined }] : [];
    profile.branch = branch || profile.branch;
    profile.semester = semester !== undefined ? Number(semester) : profile.semester;
    profile.goals = goals.length ? goals : profile.goals;
    profile.interests = interestsArr.length ? interestsArr : profile.interests;
    // Roles rule: targetRoles is canonical; targetRole mirrors targetRoles[0]
    const tr = String(targetRole).trim();
    profile.targetRoles = [tr];
    profile.targetRole = tr;
    const savedProfile = await profile.save();

    // Also save targetRole to User model for consistency
    await User.findByIdAndUpdate(req.user.id, { targetRole: tr, targetRoles: [tr] });

    log('Step1', `Profile saved: branch=${profile.branch} semester=${profile.semester} targetRole=${profile.targetRole} goals=${profile.goals?.length || 0} interests=${profile.interests?.length || 0}`);
    log('DB', `Verified StudentProfile in DB: id=${savedProfile._id} collection=studentprofiles userId=${savedProfile.userId}`);

    await advanceStep(req.user.id, 2);
    log('Step1', 'Done. User step=2');
    res.json(profile);
  } catch (err) {
    console.error('[Onboarding] Step1 error:', err.message);
    res.status(500).json({ message: err.message });
  }
}

async function resumeStep(req, res) {
  try {
    log('Step2', 'Resume upload — start');
    if (!req.file) {
      log('Step2', 'No file in request');
      return res.status(400).json({ message: 'Resume file is required' });
    }

    let resumeUrl = null;
    const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    if (hasCloudinary) {
      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          'learnoptima/resumes',
          'auto',
          req.file.mimetype || 'application/pdf',
        );
        resumeUrl = result.secure_url;
        log('Step2', `Cloudinary upload OK: ${resumeUrl}`);
      } catch (e) {
        console.error('[Onboarding] Step2 Cloudinary error:', e.message);
        resumeUrl = '/uploads/placeholder-resume.pdf';
        log('Step2', 'Cloudinary failed, using placeholder URL');
      }
    } else {
      resumeUrl = req.body.resumeUrl || '/uploads/placeholder-resume.pdf';
      log('Step2', 'No Cloudinary config, using placeholder URL');
    }

    const profile = await getOrCreateProfile(req.user.id);
    profile.resumeUrl = resumeUrl;

    let extracted = { skills: [], projects: [], education: [], experience: [] };
    const useMlResume = process.env.ENABLE_ML_RESUME === 'true' && !!process.env.ML_SERVICE_URL;
    if (useMlResume) {
      try {
        const mlResult = await mlService.parseResume(resumeUrl);
        if (mlResult && typeof mlResult === 'object') {
          extracted.skills = [...(extracted.skills || []), ...(mlResult.skills || [])];
          extracted.projects = [...(extracted.projects || []), ...(mlResult.projects || [])];
          log('Step2', `ML parse-resume: skills=${extracted.skills.length} projects=${extracted.projects.length}`);
        }
      } catch (e) {
        log('Step2', `ML parse-resume failed (${e.message}), Node parser will run`);
      }
    }
    if (req.file && req.file.buffer) {
      try {
        const nodeResult = await parseResumeBuffer(req.file.buffer, req.file.mimetype);
        if (nodeResult) {
          if (nodeResult.skills?.length) extracted.skills = [...new Set([...extracted.skills, ...nodeResult.skills])];
          if (nodeResult.projects?.length) extracted.projects = [...extracted.projects, ...nodeResult.projects];
          if (nodeResult.education?.length) extracted.education = nodeResult.education;
          if (nodeResult.experience?.length) extracted.experience = nodeResult.experience;
          if (nodeResult.certifications?.length) profile.extractedCertifications = nodeResult.certifications;
          if (nodeResult.resumeParsed) profile.resumeParsed = nodeResult.resumeParsed;
          log('Step2', `Node parser: skills=${extracted.skills.length} projects=${extracted.projects.length}`);
        }
      } catch (e) {
        log('Step2', 'Resume parser failed:', e.message);
      }
    }

    profile.extractedSkills = extracted.skills || [];
    profile.extractedEducation = extracted.education || [];
    profile.extractedExperience = extracted.experience || [];
    // extracted.projects is [{title, description, techStack}] — store in extractedProjects
    if (extracted.projects?.length) {
      profile.extractedProjects = extracted.projects;
    }
    await profile.save();
    log('Step2', `Profile saved: resumeUrl set, extractedSkills=${profile.extractedSkills?.length || 0}`);

    await advanceStep(req.user.id, 3);
    log('Step2', 'Done. User step=3');
    res.json({ resumeUrl, extractedSkills: profile.extractedSkills });
  } catch (err) {
    console.error('[Onboarding] Step2 error:', err.message);
    res.status(500).json({ message: err.message });
  }
}

async function skillsStep(req, res) {
  try {
    log('Step3', 'Extra skills & projects — start');
    let { extraSkills, projects } = req.body;
    if (typeof extraSkills === 'string') try { extraSkills = JSON.parse(extraSkills); } catch { extraSkills = []; }
    if (typeof projects === 'string') try { projects = JSON.parse(projects); } catch { projects = []; }
    // Sanitize: profile.projects is [String]. If the frontend accidentally sends
    // objects (e.g. parsed resume projects), coerce each item to a plain string.
    if (Array.isArray(projects)) {
      projects = projects
        .filter(p => p !== null && p !== undefined)
        .map(p => {
          if (typeof p === 'string') return p.trim();
          if (typeof p === 'object') return (p.title || JSON.stringify(p)).slice(0, 250);
          return String(p);
        })
        .filter(s => s.length > 0);
    }
    const profile = await getOrCreateProfile(req.user.id);
    if (Array.isArray(extraSkills)) profile.extraSkills = extraSkills;
    if (Array.isArray(projects)) profile.projects = projects;
    await profile.save();
    log('Step3', `Profile saved: extraSkills=${profile.extraSkills?.length || 0} projects=${profile.projects?.length || 0}`);
    await advanceStep(req.user.id, 4);
    log('Step3', 'Done. User step=4');
    res.json(profile);
  } catch (err) {
    console.error('[Onboarding] Step3 error:', err.message);
    res.status(500).json({ message: err.message });
  }
}

async function syllabusStep(req, res) {
  try {
    log('Step4', 'Syllabus upload — start');
    if (!req.file) {
      log('Step4', 'No file in request');
      return res.status(400).json({ message: 'Syllabus file is required' });
    }

    let syllabusUrl = null;
    const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    if (hasCloudinary) {
      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          'learnoptima/syllabus',
          'auto',
          req.file.mimetype || 'application/pdf',
        );
        syllabusUrl = result.secure_url;
        log('Step4', `Cloudinary upload OK: ${syllabusUrl}`);
      } catch (e) {
        console.error('[Onboarding] Step4 Cloudinary error:', e.message);
        syllabusUrl = '/uploads/placeholder-syllabus.pdf';
        log('Step4', 'Cloudinary failed, using placeholder URL');
      }
    } else {
      syllabusUrl = req.body.syllabusUrl || '/uploads/placeholder-syllabus.pdf';
      log('Step4', 'No Cloudinary config, using placeholder URL');
    }

    const profile = await getOrCreateProfile(req.user.id);
    profile.syllabusUrl = syllabusUrl;

    try {
      const parseResult = await syllabusParser.parseSyllabusBuffer(req.file.buffer);
      if (parseResult.subjects?.length) {
        profile.syllabusStructure = { subjects: parseResult.subjects };
        profile.syllabusSubjects = parseResult.flatSubjectNames || parseResult.subjects.map((s) => s.name).filter(Boolean);
        log('Step4', `Syllabus parsed: ${parseResult.subjects.length} subjects, ${profile.syllabusSubjects.length} names`);
      } else {
        profile.syllabusSubjects = profile.syllabusSubjects || [];
        log('Step4', 'Syllabus parser returned 0 subjects');
      }
    } catch (e) {
      log('Step4', 'Syllabus parse failed:', e.message);
      profile.syllabusSubjects = profile.syllabusSubjects || [];
    }

    await profile.save();
    log('Step4', `Profile saved: syllabusUrl set, syllabusSubjects=${profile.syllabusSubjects?.length || 0}`);
    await advanceStep(req.user.id, 5);
    log('Step4', 'Done. User step=5');
    res.json({ syllabusUrl, syllabusSubjects: profile.syllabusSubjects });
  } catch (err) {
    console.error('[Onboarding] Step4 error:', err.message);
    res.status(500).json({ message: err.message });
  }
}

async function timetableStep(req, res) {
  try {
    log('Step5', 'Timetable upload — start');
    if (!req.file) {
      log('Step5', 'No file in request');
      return res.status(400).json({ message: 'Timetable file is required' });
    }

    let timetableUrl = null;
    const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    if (hasCloudinary) {
      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          'learnoptima/timetables',
          'image',
          req.file.mimetype || 'image/jpeg',
        );
        timetableUrl = result.secure_url;
        log('Step5', `Cloudinary upload OK: ${timetableUrl}`);
      } catch (e) {
        console.error('[Onboarding] Step5 Cloudinary error:', e.message);
        timetableUrl = '/uploads/placeholder-timetable.jpg';
        log('Step5', 'Cloudinary failed, using placeholder URL');
      }
    } else {
      timetableUrl = req.body.timetableUrl || '/uploads/placeholder-timetable.jpg';
      log('Step5', 'No Cloudinary config, using placeholder URL');
    }

    const profile = await getOrCreateProfile(req.user.id);
    profile.timetableUrl = timetableUrl;
    let timetable = { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], timeSlots: [], grid: [] };
    if (process.env.ML_SERVICE_URL) {
      try {
        const mlTimetable = await mlService.extractTimetable(timetableUrl);
        if (mlTimetable && typeof mlTimetable === 'object') {
          timetable = {
            days: Array.isArray(mlTimetable.days) ? mlTimetable.days : timetable.days,
            timeSlots: Array.isArray(mlTimetable.timeSlots) ? mlTimetable.timeSlots : [],
            grid: Array.isArray(mlTimetable.grid) ? mlTimetable.grid : [],
          };
          log('Step5', `ML extract-timetable OK: days=${timetable.days.length} slots=${timetable.timeSlots.length}`);
        }
      } catch (e) {
        log('Step5', 'ML extract-timetable failed:', e.message);
      }
    }
    profile.timetable = timetable;
    await profile.save();
    log('Step5', 'Profile saved: timetableUrl and timetable set');

    await advanceStep(req.user.id, TOTAL_STEPS + 1);
    log('Step5', 'Done. Onboarding complete.');
    res.json({ timetableUrl, timetable: profile.timetable });
  } catch (err) {
    console.error('[Onboarding] Step5 error:', err.message);
    res.status(500).json({ message: err.message });
  }
}

async function getProfile(req, res) {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user.id });
    if (!profile) return res.json(null);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  profileStep,
  resumeStep,
  skillsStep,
  syllabusStep,
  timetableStep,
  getProfile,
};

