const router = require('express').Router();
const axios = require('axios');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const mlService = require('../services/mlService');
const resumeParser = require('../services/nlpResumeParser');
const syllabusParser = require('../services/syllabusParser');

const DOC_TYPES        = { resume: 'resumeUrl', syllabus: 'syllabusUrl', timetable: 'timetableUrl' };
const DOC_CONTENT_TYPE = { resume: 'application/pdf', syllabus: 'application/pdf', timetable: 'image/png' };

function mlResumeEnabled() {
  return process.env.ENABLE_ML_RESUME === 'true' && !!process.env.ML_SERVICE_URL;
}

function buildParsingInfo() {
  const ml = mlResumeEnabled();
  return {
    mlServiceConfigured: ml,
    resumeHowItWorks: ml
      ? 'Resume: ML service (ENABLE_ML_RESUME=true) augments skills/projects. Node NLP parser does fast regex section detection + NER entity extraction.'
      : 'Resume: Node NLP parser — regex section detection, NER-enhanced skill/education/experience extraction, structured project objects with deduplication.',
    syllabusHowItWorks: 'Syllabus: Node heuristics build subjects → chapters → topics.',
    limitation: 'Scanned/image-only PDFs have no extractable text. Use OCR for those.',
  };
}

function mergeProfilePayload(u, p) {
  return {
    name:       u.name,
    email:      u.email,
    college:    p.college    || u.college,
    branch:     p.branch     || u.branch,
    semester:   p.semester   ?? u.semester,
    targetRoles: p.targetRoles || u.targetRoles || [],
    // Always resolve a singular role so pages like CareerRoadmap don't redirect:
    // priority → StudentProfile.targetRole → User.targetRole → first entry in targetRoles array
    targetRole: (() => {
      const roles = p.targetRoles || u.targetRoles || [];
      return p.targetRole || u.targetRole || roles[0] || null;
    })(),
    customRole: p.customRole || '',
    bio:        p.bio        || '',
    cgpa:       p.cgpa,
    goals:      p.goals      || [],
    interests:  p.interests  || u.interests || [],

    // User-editable skills (shown as editable tags)
    skills:    p.extraSkills || [],

    // Parsed / extracted fields
    extractedSkills:        p.extractedSkills        || [],
    extractedEducation:     p.extractedEducation     || [],
    extractedExperience:    p.extractedExperience    || [],
    extractedCertifications:p.extractedCertifications|| [],
    extractedProjects:      p.extractedProjects      || [],   // structured objects

    // Legacy string projects (user notes)
    projects: p.projects || [],

    // Documents
    resumeUrl:    p.resumeUrl,
    resumeParsed: p.resumeParsed,
    syllabusUrl:  p.syllabusUrl,
    timetableUrl: p.timetableUrl,

    // Syllabus
    syllabusSubjects:  p.syllabusSubjects  || [],
    syllabusStructure: p.syllabusStructure || { subjects: [] },

    // Timetable
    timetable: p.timetable || { days: [], timeSlots: [], grid: [] },

    parsingInfo: buildParsingInfo(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guessMimeFromResumeUrl(url, headerCt) {
  const h = (headerCt || '').toLowerCase();
  if (h.includes('wordprocessingml') || h.includes('officedocument'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (h.includes('msword') && !h.includes('openxml')) return 'application/msword';
  const lower = (url || '').toLowerCase();
  if (lower.includes('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.includes('.doc') && !lower.includes('.docx')) return 'application/msword';
  return 'application/pdf';
}

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
  } catch { return url; }
}

function guessDocFilename(type, sourceUrl) {
  const lower = (sourceUrl || '').toLowerCase();
  if (lower.endsWith('.docx') || lower.includes('.docx')) return `${type}.docx`;
  if (lower.endsWith('.doc') || (lower.includes('/raw/upload/') && lower.includes('doc'))) return `${type}.doc`;
  return `${type}.pdf`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Proxy: stream document from Cloudinary through the API (avoids CORS / auth issues) */
async function documentProxy(req, res) {
  try {
    const type  = (req.params.type || '').toLowerCase();
    const field = DOC_TYPES[type];
    if (!field) return res.status(400).json({ message: 'Invalid document type' });

    let userId = req.user?.id;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try { userId = new mongoose.Types.ObjectId(userId); } catch { /* keep */ }
    }
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const profile = await StudentProfile.findOne({ userId });
    const url     = profile?.[field] && String(profile[field]).trim();
    if (!url || !url.startsWith('http')) return res.status(404).json({ message: 'Document not found' });

    const primaryUrl = type === 'timetable' ? url : cloudinaryInlineUrl(url);
    const axiosOpts  = {
      responseType: 'stream', maxRedirects: 5, timeout: 60000,
      validateStatus: () => true,
      headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
    };
    let resp = await axios.get(primaryUrl, axiosOpts);
    if (resp.status !== 200 && primaryUrl !== url) resp = await axios.get(url, axiosOpts);
    if (resp.status !== 200) return res.status(502).json({ message: 'Failed to fetch document' });

    const filename    = guessDocFilename(type, url);
    let   contentType = DOC_CONTENT_TYPE[type];
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
    if (!res.headersSent) res.status(502).json({ message: 'Failed to load document' });
  }
}

/** Re-parse: re-fetch resume & syllabus URLs and re-run all parsers */
async function reparseDocuments(req, res) {
  try {
    let profile = await StudentProfile.findOne({ userId: req.user.id });
    if (!profile) profile = await StudentProfile.create({ userId: req.user.id });

    const results = { resume: null, syllabus: null, errors: [] };

    // ── Resume ──────────────────────────────────────────────────────────────
    if (profile.resumeUrl?.startsWith('http')) {
      try {
        const r = await axios.get(profile.resumeUrl, {
          responseType: 'arraybuffer', timeout: 120000,
          maxRedirects: 5, validateStatus: () => true,
        });
        if (r.status < 200 || r.status >= 400) throw new Error(`HTTP ${r.status} fetching resume`);

        const buffer = Buffer.from(r.data);
        const mime   = guessMimeFromResumeUrl(profile.resumeUrl, r.headers['content-type']);

        let extracted = { skills: [], projects: [], education: [], experience: [], certifications: [] };

        // Optional ML service
        if (mlResumeEnabled()) {
          try {
            const mlResult = await mlService.parseResume(profile.resumeUrl);
            if (mlResult && typeof mlResult === 'object') {
              extracted.skills   = mlResult.skills   || [];
              extracted.projects = mlResult.projects || [];
            }
          } catch (e) { results.errors.push(`ML resume: ${e.message}`); }
        }

        // Node NLP parser (always runs)
        const nodeResult = await resumeParser.parseResumeBuffer(buffer, mime);
        if (nodeResult) {
          extracted.skills   = [...new Set([...extracted.skills,   ...(nodeResult.skills   || [])])];
          extracted.education     = nodeResult.education     || [];
          extracted.experience    = nodeResult.experience    || [];
          extracted.certifications= nodeResult.certifications|| [];

          // projects from parser are now structured objects { title, description, techStack }
          // Merge with any ML-extracted projects (strings) by converting to objects
          const mlProjectObjs = (extracted.projects || []).map(p =>
            typeof p === 'string' ? { title: p, description: '', techStack: [] } : p
          );
          const nodeProjects = nodeResult.projects || [];
          // Deduplicate by title
          const allProjectsMap = new Map();
          [...mlProjectObjs, ...nodeProjects].forEach(p => {
            const key = (p.title || '').toLowerCase().slice(0, 40);
            if (!allProjectsMap.has(key)) allProjectsMap.set(key, p);
          });
          extracted.projects = [...allProjectsMap.values()];

          if (nodeResult.resumeParsed) profile.resumeParsed = nodeResult.resumeParsed;
        }

        profile.extractedSkills         = extracted.skills;
        profile.extractedEducation      = extracted.education;
        profile.extractedExperience     = extracted.experience;
        profile.extractedCertifications = extracted.certifications;
        profile.extractedProjects       = extracted.projects; // structured objects

        results.resume = {
          extractedSkills:    profile.extractedSkills.length,
          extractedProjects:  profile.extractedProjects.length,
          education:          profile.extractedEducation.length,
          certifications:     profile.extractedCertifications.length,
        };
      } catch (e) { results.errors.push(`Resume: ${e.message}`); }
    } else {
      results.errors.push('No resume URL stored on profile.');
    }

    // ── Syllabus ─────────────────────────────────────────────────────────────
    if (profile.syllabusUrl?.startsWith('http')) {
      try {
        const r = await axios.get(profile.syllabusUrl, {
          responseType: 'arraybuffer', timeout: 120000,
          maxRedirects: 5, validateStatus: () => true,
        });
        if (r.status < 200 || r.status >= 400) throw new Error(`HTTP ${r.status} fetching syllabus`);

        const buffer      = Buffer.from(r.data);
        const parseResult = await syllabusParser.parseSyllabusBuffer(buffer);
        if (parseResult.subjects?.length) {
          profile.syllabusStructure = { subjects: parseResult.subjects };
          profile.syllabusSubjects  = parseResult.flatSubjectNames
            || parseResult.subjects.map(s => s.name).filter(Boolean);
        }
        results.syllabus = {
          subjectGroups: parseResult.subjects?.length || 0,
          flatNames:     (profile.syllabusSubjects || []).length,
        };
      } catch (e) { results.errors.push(`Syllabus: ${e.message}`); }
    } else {
      results.errors.push('No syllabus URL stored on profile.');
    }

    await profile.save();

    const user = await User.findById(req.user.id).select('-password');
    const u = user.toObject  ? user.toObject()    : user;
    const p = profile.toObject ? profile.toObject() : profile;
    res.json({ ...mergeProfilePayload(u, p), reparseResults: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── CRUD routes ──────────────────────────────────────────────────────────────

router.get('/documents/:type', auth, documentProxy);
router.post('/reparse', auth, reparseDocuments);

// ─── Upload document (resume / syllabus) → Cloudinary → save URL → reparse ──
router.post('/upload-document', auth, async (req, res) => {
  try {
    const { upload, uploadToCloudinary } = require('../middleware/uploadMiddleware');
    const docType = req.query.type || req.body?.type || 'resume'; // 'resume' | 'syllabus'
    if (!['resume', 'syllabus'].includes(docType)) {
      return res.status(400).json({ message: 'Invalid type. Use resume or syllabus.' });
    }

    // Process multipart upload using multer
    const uploadSingle = upload.single('file');
    await new Promise((resolve, reject) => uploadSingle(req, res, (err) => (err ? reject(err) : resolve())));
    if (!req.file) return res.status(400).json({ message: 'No file uploaded. Send file as multipart/form-data field "file".' });

    const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    if (!hasCloudinary) return res.status(503).json({ message: 'Cloudinary not configured. Please add env vars.' });

    // Upload to Cloudinary
    const folder = docType === 'resume' ? 'resumes' : 'syllabus';
    const cloudResult = await uploadToCloudinary(req.file.buffer, folder, 'raw', req.file.mimetype);
    const fileUrl = cloudResult.secure_url;

    // Save URL to profile
    let profile = await StudentProfile.findOne({ userId: req.user.id });
    if (!profile) profile = await StudentProfile.create({ userId: req.user.id });
    if (docType === 'resume') profile.resumeUrl = fileUrl;
    else profile.syllabusUrl = fileUrl;
    await profile.save();

    // Trigger reparse automatically
    req.body = {}; // ensure clean body for reparse
    return reparseDocuments(req, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const profile = await StudentProfile.findOne({ userId: req.user.id });
    const u = user.toObject    ? user.toObject()    : user;
    const p = profile ? (profile.toObject ? profile.toObject() : profile) : {};
    res.json(mergeProfilePayload(u, p));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const {
      name, email, branch, semester, college, targetRole, targetRoles, customRole,
      bio, cgpa, goals, interests, skills, projects,
      syllabusStructure, syllabusSubjects,
    } = req.body;
    const userId = req.user.id;

    if (name !== undefined || email !== undefined || targetRole !== undefined || targetRoles !== undefined) {
      const userUpdate = {};
      if (name       !== undefined) userUpdate.name       = name;
      if (email      !== undefined) userUpdate.email      = email;
      if (targetRole !== undefined) userUpdate.targetRole = targetRole;
      if (targetRoles !== undefined) userUpdate.targetRoles = targetRoles;
      await User.findByIdAndUpdate(userId, userUpdate);
    }

    let profile = await StudentProfile.findOne({ userId });
    if (!profile) profile = await StudentProfile.create({ userId });

    if (branch     !== undefined) profile.branch     = branch;
    if (semester   !== undefined) profile.semester   = semester;
    if (college    !== undefined) profile.college    = college;
    if (targetRole !== undefined) profile.targetRole = targetRole;
    if (targetRoles !== undefined) profile.targetRoles = targetRoles;
    if (customRole !== undefined) profile.customRole = customRole;
    if (bio        !== undefined) profile.bio        = bio;
    if (cgpa       !== undefined) profile.cgpa = (cgpa == null || cgpa === '') ? undefined : Number(cgpa);
    if (Array.isArray(goals))     profile.goals      = goals;
    if (Array.isArray(interests)) profile.interests  = interests;
    if (Array.isArray(projects)) {
      // profile.projects is [String] — coerce any accidentally-sent objects to strings
      const sanitizedProjects = projects
        .filter(p => p !== null && p !== undefined)
        .map(p => {
          if (typeof p === 'string') return p.trim();
          if (typeof p === 'object') return (p.title || JSON.stringify(p)).slice(0, 250);
          return String(p);
        })
        .filter(s => s.length > 0);
      profile.projects = sanitizedProjects;
    }
    if (Array.isArray(skills))    profile.extraSkills= skills;  // user-added skills
    if (syllabusStructure !== undefined && syllabusStructure !== null && typeof syllabusStructure === 'object') {
      profile.syllabusStructure = syllabusStructure;
    }
    if (Array.isArray(syllabusSubjects)) profile.syllabusSubjects = syllabusSubjects;

    await profile.save();

    const user = await User.findById(userId).select('-password');
    const u = user.toObject    ? user.toObject()    : user;
    const p = profile.toObject ? profile.toObject() : profile;
    res.json(mergeProfilePayload(u, p));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;