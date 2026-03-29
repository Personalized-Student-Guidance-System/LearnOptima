const router = require('express').Router();
const axios = require('axios');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const mlService = require('../services/mlService');
const resumeParser = require('../services/resumeParser');
const syllabusParser = require('../services/syllabusParser');

const DOC_TYPES = { resume: 'resumeUrl', syllabus: 'syllabusUrl', timetable: 'timetableUrl' };
const DOC_CONTENT_TYPE = { resume: 'application/pdf', syllabus: 'application/pdf', timetable: 'image/png' };

function mlResumeEnabled() {
  return process.env.ENABLE_ML_RESUME === 'true' && !!process.env.ML_SERVICE_URL;
}

function buildParsingInfo() {
  const ml = mlResumeEnabled();
  return {
    mlServiceConfigured: ml,
    resumeHowItWorks: ml
      ? 'Resume: Optional ML at ML_SERVICE_URL (ENABLE_ML_RESUME=true) may add skills/projects. The Node.js parser always runs on the file (PDF via pdf-parse, DOCX via mammoth): sections, skills, projects, education, experience, certifications, and resumeParsed.'
      : 'Resume: Node.js only (PDF + DOCX). Set ENABLE_ML_RESUME=true and ML_SERVICE_URL to optionally merge ML output; otherwise all extraction is rule-based.',
    syllabusHowItWorks:
      'Syllabus: Node.js only — pdf-parse plus heuristics to build subjects → chapters → topics. There is no ML syllabus parser in this app.',
    limitation:
      'Scanned/image-only PDFs have no extractable text, so parsers return empty until OCR is added.',
  };
}

function mergeProfilePayload(u, p) {
  const skills = [...(p.extractedSkills || []), ...(p.extraSkills || [])];
  return {
    name: u.name,
    email: u.email,
    college: u.college,
    branch: p.branch || u.branch,
    semester: p.semester ?? u.semester,
    targetRole: p.targetRole || u.targetRole,
    bio: p.bio,
    cgpa: p.cgpa,
    goals: p.goals || [],
    interests: p.interests?.length ? p.interests : u.interests || [],
    skills: [...new Set(skills)],
    extractedSkills: p.extractedSkills || [],
    extractedEducation: p.extractedEducation || [],
    extractedExperience: p.extractedExperience || [],
    extractedCertifications: p.extractedCertifications || [],
    extraSkills: p.extraSkills || [],
    projects: p.projects || [],
    resumeUrl: p.resumeUrl,
    resumeParsed: p.resumeParsed,
    syllabusUrl: p.syllabusUrl,
    timetableUrl: p.timetableUrl,
    syllabusSubjects: p.syllabusSubjects || [],
    syllabusStructure: p.syllabusStructure || { subjects: [] },
    timetable: p.timetable || { days: [], timeSlots: [], grid: [] },
    parsingInfo: buildParsingInfo(),
  };
}

function guessMimeFromResumeUrl(url, headerCt) {
  const h = (headerCt || '').toLowerCase();
  if (h.includes('wordprocessingml') || h.includes('officedocument')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (h.includes('msword') && !h.includes('openxml')) return 'application/msword';
  const lower = (url || '').toLowerCase();
  if (lower.includes('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.includes('.doc') && !lower.includes('.docx')) return 'application/msword';
  return 'application/pdf';
}

/** Cloudinary raw uploads often send attachment; fl_inline asks for inline delivery. */
function cloudinaryInlineUrl(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('cloudinary.com')) return url;
    if (u.pathname.includes('/fl_inline/')) return url;
    if (u.pathname.includes('/raw/upload/')) {
      u.pathname = u.pathname.replace('/raw/upload/', '/raw/upload/fl_inline/');
      return u.toString();
    }
    if (u.pathname.includes('/image/upload/') && /\.pdf(\?|$)/i.test(u.pathname + u.search)) {
      u.pathname = u.pathname.replace('/image/upload/', '/image/upload/fl_inline/');
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function guessDocFilename(type, sourceUrl) {
  const lower = (sourceUrl || '').toLowerCase();
  if (lower.endsWith('.docx') || lower.includes('.docx')) return `${type}.docx`;
  if (lower.endsWith('.doc') || (lower.includes('/raw/upload/') && lower.includes('doc'))) return `${type}.doc`;
  return `${type}.pdf`;
}

async function documentProxy(req, res) {
  try {
    const type = (req.params.type || '').toLowerCase();
    const field = DOC_TYPES[type];
    if (!field) return res.status(400).json({ message: 'Invalid document type' });
    let userId = req.user?.id;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        userId = new mongoose.Types.ObjectId(userId);
      } catch {
        /* keep */
      }
    }
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const profile = await StudentProfile.findOne({ userId });
    const url = profile?.[field] && String(profile[field]).trim();
    if (!url || !url.startsWith('http')) return res.status(404).json({ message: 'Document not found' });

    const primaryUrl = type === 'timetable' ? url : cloudinaryInlineUrl(url);
    const axiosOpts = {
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 60000,
      validateStatus: () => true,
      headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
    };
    let resp = await axios.get(primaryUrl, axiosOpts);
    if (resp.status !== 200 && primaryUrl !== url) {
      resp = await axios.get(url, axiosOpts);
    }
    if (resp.status !== 200) return res.status(502).json({ message: 'Failed to fetch document' });

    const filename = guessDocFilename(type, url);
    let contentType = DOC_CONTENT_TYPE[type];
    if (type === 'resume' || type === 'syllabus') {
      if (/\.docx/i.test(url)) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (/\.doc/i.test(url) && !/\.docx/i.test(url)) contentType = 'application/msword';
      else contentType = 'application/pdf';
    } else {
      const rawCt = resp.headers['content-type'];
      if (rawCt) contentType = rawCt.split(';')[0].trim() || contentType;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    resp.data.pipe(res);
  } catch (err) {
    if (res.headersSent) return;
    res.status(502).json({ message: 'Failed to load document' });
  }
}

async function reparseDocuments(req, res) {
  try {
    let profile = await StudentProfile.findOne({ userId: req.user.id });
    if (!profile) profile = await StudentProfile.create({ userId: req.user.id });

    const results = { resume: null, syllabus: null, errors: [] };

    if (profile.resumeUrl && profile.resumeUrl.startsWith('http')) {
      try {
        const r = await axios.get(profile.resumeUrl, {
          responseType: 'arraybuffer',
          timeout: 120000,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        if (r.status < 200 || r.status >= 400) {
          throw new Error(`HTTP ${r.status} fetching resume`);
        }
        const buffer = Buffer.from(r.data);
        const mime = guessMimeFromResumeUrl(profile.resumeUrl, r.headers['content-type']);

        let extracted = { skills: [], projects: [], education: [], experience: [] };
        if (mlResumeEnabled()) {
          try {
            const mlResult = await mlService.parseResume(profile.resumeUrl);
            if (mlResult && typeof mlResult === 'object') {
              extracted.skills = [...(mlResult.skills || [])];
              extracted.projects = [...(mlResult.projects || [])];
            }
          } catch (e) {
            results.errors.push(`ML resume: ${e.message}`);
          }
        }
        const nodeResult = await resumeParser.parseResumeBuffer(buffer, mime);
        if (nodeResult) {
          if (nodeResult.skills?.length) extracted.skills = [...new Set([...extracted.skills, ...nodeResult.skills])];
          if (nodeResult.projects?.length) extracted.projects = [...new Set([...extracted.projects, ...nodeResult.projects])];
          if (nodeResult.education?.length) extracted.education = nodeResult.education;
          if (nodeResult.experience?.length) extracted.experience = nodeResult.experience;
          if (nodeResult.certifications?.length) profile.extractedCertifications = nodeResult.certifications;
          if (nodeResult.resumeParsed) profile.resumeParsed = nodeResult.resumeParsed;
        }
        profile.extractedSkills = extracted.skills || [];
        profile.extractedEducation = extracted.education || [];
        profile.extractedExperience = extracted.experience || [];
        profile.projects = [...new Set([...(profile.projects || []), ...(extracted.projects || [])])];
        results.resume = {
          extractedSkills: profile.extractedSkills.length,
          totalProjectsStored: profile.projects.length,
        };
      } catch (e) {
        results.errors.push(`Resume: ${e.message}`);
      }
    } else {
      results.errors.push('No resume URL stored on profile.');
    }

    if (profile.syllabusUrl && profile.syllabusUrl.startsWith('http')) {
      try {
        const r = await axios.get(profile.syllabusUrl, {
          responseType: 'arraybuffer',
          timeout: 120000,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        if (r.status < 200 || r.status >= 400) {
          throw new Error(`HTTP ${r.status} fetching syllabus`);
        }
        const buffer = Buffer.from(r.data);
        const parseResult = await syllabusParser.parseSyllabusBuffer(buffer);
        if (parseResult.subjects?.length) {
          profile.syllabusStructure = { subjects: parseResult.subjects };
          profile.syllabusSubjects = parseResult.flatSubjectNames || parseResult.subjects.map((s) => s.name).filter(Boolean);
        }
        results.syllabus = {
          subjectGroups: parseResult.subjects?.length || 0,
          flatNames: (profile.syllabusSubjects || []).length,
        };
      } catch (e) {
        results.errors.push(`Syllabus: ${e.message}`);
      }
    } else {
      results.errors.push('No syllabus URL stored on profile.');
    }

    await profile.save();
    const user = await User.findById(req.user.id).select('-password');
    const u = user.toObject ? user.toObject() : user;
    const p = profile.toObject ? profile.toObject() : profile;
    res.json({ ...mergeProfilePayload(u, p), reparseResults: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

router.get('/documents/:type', auth, documentProxy);
router.post('/reparse', auth, reparseDocuments);

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const profile = await StudentProfile.findOne({ userId: req.user.id });
    const u = user.toObject ? user.toObject() : user;
    const p = profile ? (profile.toObject ? profile.toObject() : profile) : {};
    res.json(mergeProfilePayload(u, p));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const {
      name,
      email,
      branch,
      semester,
      college,
      targetRole,
      bio,
      cgpa,
      goals,
      interests,
      skills,
      projects,
    } = req.body;
    const userId = req.user.id;

    if (name !== undefined || email !== undefined) {
      const userUpdate = {};
      if (name !== undefined) userUpdate.name = name;
      if (email !== undefined) userUpdate.email = email;
      await User.findByIdAndUpdate(userId, userUpdate);
    }

    let profile = await StudentProfile.findOne({ userId });
    if (!profile) profile = await StudentProfile.create({ userId });

    if (branch !== undefined) profile.branch = branch;
    if (semester !== undefined) profile.semester = semester;
    if (college !== undefined) profile.college = college;
    if (targetRole !== undefined) profile.targetRole = targetRole;
    if (bio !== undefined) profile.bio = bio;
    if (cgpa !== undefined) profile.cgpa = cgpa == null || cgpa === '' ? undefined : Number(cgpa);
    if (Array.isArray(goals)) profile.goals = goals;
    if (Array.isArray(interests)) profile.interests = interests;
    if (Array.isArray(projects)) profile.projects = projects;
    if (Array.isArray(skills)) profile.extraSkills = skills;
    await profile.save();

    const user = await User.findById(userId).select('-password');
    const u = user.toObject ? user.toObject() : user;
    const p = profile.toObject ? profile.toObject() : profile;
    res.json(mergeProfilePayload(u, p));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
