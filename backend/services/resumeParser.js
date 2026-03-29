/**
 * Node-only resume parsing: PDF (pdf-parse), DOCX (mammoth).
 * Multi-strategy: section headers, bullets, comma-separated skills, keyword mining.
 */
const { extractTextFromPdfBuffer } = require('./pdfText');

let mammoth = null;
try {
  mammoth = require('mammoth');
} catch {
  /* optional */
}

const SECTION_PATTERNS = [
  { key: 'summary', re: /^(summary|objective|profile|about\s*me|career\s*objective)\s*:?\s*$/i },
  { key: 'education', re: /^(education|academic|qualifications?|university|degree)\b/i },
  { key: 'experience', re: /^(experience|work\s*history|employment|professional\s*experience|internship|career)\b/i },
  { key: 'projects', re: /^(projects?|academic\s*projects?|key\s*projects?|portfolio)\b/i },
  { key: 'skills', re: /^(skills?|technical\s*skills|core\s*competencies|technologies|tools|expertise)\b/i },
  { key: 'certifications', re: /^(certifications?|certificates?|licenses?|awards?)\b/i },
];

const SKILL_KEYWORDS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'Scala',
  'React', 'Angular', 'Vue', 'Node.js', 'Node', 'Express', 'Next.js', 'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot',
  'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Firebase', 'DynamoDB', 'Oracle', 'SQLite',
  'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Linux', 'REST', 'GraphQL', 'Microservices',
  'HTML', 'CSS', 'SASS', 'Tailwind', 'Bootstrap', 'webpack', 'Redux',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP', 'Data Science', 'Pandas', 'NumPy', 'Scikit-learn',
  'Excel', 'Tableau', 'Power BI', 'Salesforce', 'Apex', 'LWC', 'Lightning Web Components', 'Visualforce', 'SOQL', 'SOSL',
  'Flow', 'Process Builder', 'JIRA', 'Agile', 'Scrum', 'CI/CD', 'Jenkins', 'Terraform',
  'Networking', 'TCP/IP', 'OOP', 'System Design', 'Algorithms', 'Data Structures',
];

function normalizeText(raw) {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function extractTextFromBuffer(buffer, mimetype = 'application/pdf') {
  if (!buffer || !buffer.length) return '';
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && mammoth) {
    const { value } = await mammoth.extractRawText({ buffer });
    return normalizeText(value || '');
  }
  if (mimetype === 'application/msword' && mammoth) {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return normalizeText(value || '');
    } catch {
      return '';
    }
  }
  try {
    const raw = await extractTextFromPdfBuffer(buffer);
    const text = normalizeText(raw);
    if (!text) console.warn('[resumeParser] PDF text empty; file may be scanned/image-only.');
    return text;
  } catch (e) {
    console.warn('[resumeParser] PDF extract failed:', e.message);
    return '';
  }
}

function linesFromText(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function detectSection(line) {
  const clean = line.replace(/^[\d\.\)\s]+/, '').trim();
  for (const { key, re } of SECTION_PATTERNS) {
    if (re.test(clean)) return key;
  }
  return null;
}

/** Sliding window: assign lines to nearest section header above */
function parseSectionsWithFallback(lines) {
  const buckets = {
    summary: [],
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: [],
    other: [],
  };
  let current = 'other';
  for (const line of lines) {
    const sec = detectSection(line);
    if (sec) {
      current = sec;
      continue;
    }
    if (line.length < 2) continue;
    if (buckets[current]) buckets[current].push(line);
    else buckets.other.push(line);
  }
  return buckets;
}

function extractEmailPhone(text) {
  const emails = [...new Set(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])];
  const phones = [...new Set(text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [])];
  return { emails: emails.slice(0, 3), phones: phones.slice(0, 3) };
}

function extractSkillsFromBuckets(buckets, fullText) {
  const found = new Set();

  const addFromLine = (line) => {
    const l = line.replace(/^[-•*·]\s*/, '').trim();
    if (l.includes(',')) {
      l.split(/[,|;/]/).forEach((s) => {
        const t = s.trim();
        if (t.length >= 2 && t.length <= 60) found.add(t);
      });
    } else if (l.length >= 2 && l.length <= 50 && !/[.!?]{2,}/.test(l)) {
      found.add(l);
    }
  };

  (buckets.skills || []).forEach(addFromLine);
  (buckets.summary || []).slice(0, 3).forEach(addFromLine);

  for (const kw of SKILL_KEYWORDS) {
    if (fullText.toLowerCase().includes(kw.toLowerCase())) found.add(kw);
  }

  return [...found].filter((s) => !/^(and|or|the|with|for|from|to|in|at)$/i.test(s)).slice(0, 80);
}

function extractEducationLines(lines) {
  const out = [];
  const eduHint = /(b\.?tech|b\.?e|m\.?tech|m\.?s|b\.?sc|m\.?sc|bachelor|master|degree|university|college|institute|cgpa|gpa|\d{4}\s*[-–]\s*\d{4})/i;
  for (const line of lines) {
    if (line.length < 8 || line.length > 200) continue;
    if (eduHint.test(line)) out.push(line);
  }
  return [...new Set(out)].slice(0, 25);
}

function extractExperienceLines(lines) {
  const out = [];
  const expHint = /(intern|engineer|developer|analyst|consultant|manager|lead|associate|soldier|pvt|ltd|inc|corp|20\d{2}|present|current)/i;
  for (const line of lines) {
    if (line.length < 10 || line.length > 220) continue;
    if (expHint.test(line)) out.push(line);
  }
  return [...new Set(out)].slice(0, 25);
}

function extractProjectLines(lines) {
  const out = [];
  for (const line of lines) {
    if (line.length < 12 || line.length > 200) continue;
    if (/\b(project|built|developed|created|designed|implemented|github|http)/i.test(line)) out.push(line);
  }
  return [...new Set(out)].slice(0, 20);
}

function extractCertLines(lines) {
  const out = [];
  for (const line of lines) {
    if (line.length < 6 || line.length > 180) continue;
    if (/\b(certif|certified|course|udemy|coursera|nptel|salesforce|trailhead|oracle|microsoft|aws)\b/i.test(line)) out.push(line);
  }
  return [...new Set(out)].slice(0, 20);
}

function mergeArrays(base, extra) {
  return [...new Set([...(base || []), ...(extra || [])])].filter(Boolean);
}

async function parseResumeBuffer(buffer, mimetype = 'application/pdf') {
  const rawText = await extractTextFromBuffer(buffer, mimetype);
  if (!rawText) {
    return {
      skills: [],
      projects: [],
      education: [],
      experience: [],
      certifications: [],
      resumeParsed: { rawTextLength: 0, contact: {}, sections: {} },
    };
  }

  const lines = linesFromText(rawText);
  const buckets = parseSectionsWithFallback(lines);

  let skills = extractSkillsFromBuckets(buckets, rawText);
  if (skills.length < 5) {
    skills = mergeArrays(skills, extractSkillsFromBuckets({ skills: lines.slice(0, 40), summary: [] }, rawText));
  }

  let education = (buckets.education || []).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter((l) => l.length > 5);
  education = mergeArrays(education, extractEducationLines(buckets.education.length ? buckets.education : lines));

  let experience = (buckets.experience || []).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter((l) => l.length > 8);
  experience = mergeArrays(experience, extractExperienceLines(buckets.experience.length ? buckets.experience : lines));

  let projects = (buckets.projects || []).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter((l) => l.length > 8);
  projects = mergeArrays(projects, extractProjectLines(buckets.projects.length ? buckets.projects : lines));

  let certifications = (buckets.certifications || []).map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter((l) => l.length > 4);
  certifications = mergeArrays(certifications, extractCertLines(lines));

  const contact = extractEmailPhone(rawText);

  const resumeParsed = {
    rawTextLength: rawText.length,
    lineCount: lines.length,
    contact,
    sections: {
      summary: (buckets.summary || []).slice(0, 15),
      education: education.slice(0, 30),
      experience: experience.slice(0, 30),
      projects: projects.slice(0, 25),
      skills: skills.slice(0, 50),
      certifications: certifications.slice(0, 25),
    },
  };

  return {
    skills,
    projects,
    education,
    experience,
    certifications,
    resumeParsed,
  };
}

module.exports = { parseResumeBuffer, extractTextFromBuffer };
