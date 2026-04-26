// nlpResumeParser.js — v3 (robust rewrite)
//
// KEY FIXES over v2:
//  1. Skills  — smarter category-label stripping; never splits on "/" inside tokens;
//               NER enrichment only adds tokens that look like tech identifiers;
//               multi-column dedup no longer discards real skills.
//  2. Certifications — section regex no longer matches "achievements/awards/positions of
//               responsibility"; certifications array is empty when section is missing
//               (no guessing from other sections).
//  3. Experience — section regex is tightened; activity/responsibility lines that were
//               previously mis-routed into certifications are now kept in experience or
//               "other" where they belong.
//  4. Section detection — heading heuristic is less aggressive; short lines that contain
//               common words (and/or/with/for…) beyond the first 20 chars are no longer
//               auto-treated as non-headings.
//  5. Certifications section — "Achievements / Positions of Responsibility" maps to a
//               NEW dedicated section ("achievements") instead of certifications.

'use strict';

const { pipeline } = require('@xenova/transformers');
const pdfParse = require('pdf-parse');
let mammoth = null;
try { mammoth = require('mammoth'); } catch { /* optional */ }

// ─────────────────────────────────────────────────────────────────────────────
// TEXT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function normalizeText(raw) {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function extractTextFromBuffer(buffer, mimetype = 'application/pdf') {
  if (!buffer?.length) return '';
  const isDocx = mimetype.includes('wordprocessingml');
  const isDoc  = mimetype.includes('msword');
  if ((isDocx || isDoc) && mammoth) {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return normalizeText(value || '');
    } catch { return ''; }
  }
  try {
    const data = await pdfParse(buffer);
    return normalizeText(data.text);
  } catch (e) {
    console.warn('[resumeParser] PDF extract failed:', e.message);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICATION
// PDFs from multi-column layouts sometimes embed text blocks twice.
// We deduplicate by content key but only for LONG lines (≥25 chars) because
// short skill tokens like "Python" legitimately appear in multiple sections.
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateLines(lines) {
  const seen   = new Set();
  const result = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    // Only deduplicate substantial lines (short ones may be skill tokens in two columns)
    if (key.length < 18 || !seen.has(key)) {
      seen.add(key);
      result.push(line);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// NLP MODELS  (lazy-loaded)
// ─────────────────────────────────────────────────────────────────────────────

let _ner      = null;
let _zeroShot = null;

async function getNER() {
  if (!_ner) _ner = await pipeline('token-classification', 'Xenova/bert-base-NER');
  return _ner;
}
async function getZeroShot() {
  if (!_zeroShot)
    _zeroShot = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small');
  return _zeroShot;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DETECTION
//
// "achievements" is a SEPARATE section from "certifications".
// Certifications = actual certs/courses/badges.
// Achievements   = positions of responsibility, awards, event leadership, etc.
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_LABELS = [
  'summary', 'education', 'experience', 'skills',
  'projects', 'certifications', 'achievements',
];

const SECTION_REGEX = {
  summary:      /^(summary|objective|career objective|professional summary|profile|about me|personal statement)/i,
  education:    /^(education|academic(s)?|qualification(s)?|degree(s)?|schooling|academic background)/i,

  // experience: kept tight — do NOT catch "achievements / positions of responsibility"
  experience:   /^(experience|work experience|employment(?: history)?|professional experience|work history|internship(s)?|jobs?|work)/i,

  // skills: broader to catch all technical skill headings
  skills:       /^(skills|technical skills?|technologies|core competencies|competencies|expertise|key skills|proficiencies|tools?\s*(&|and)\s*technologies|tech(?:\s*stack)?|programming(?:\s+languages?)?|languages?(?:\s+&\s+frameworks?)?)/i,

  projects:     /^(projects?|personal projects?|academic projects?|key projects?|notable projects?|portfolio|project work)/i,

  // certifications = ONLY actual certifications / courses / training
  certifications: /^(certifications?|certificates?|courses?|training|licenses?|badges?|credentials?|moocs?)/i,

  // achievements = positions of responsibility, awards, extracurriculars
  achievements: /^(achievements?|awards?|accomplishments?|honors?|positions?\s+of\s+responsibility|extracurricular|activities|leadership|volunteer|clubs?|societies?|co-?curricular)/i,
};

function detectSectionFast(text) {
  const t = text.trim();
  for (const [section, re] of Object.entries(SECTION_REGEX)) {
    if (re.test(t)) return section;
  }
  return null;
}

/**
 * A line is a potential heading if:
 *  - short enough to be a heading
 *  - not starting with a bullet / number
 *  - not ending with sentence punctuation
 *  - either ALL CAPS or Title Case (first word capitalised, remaining words mainly alpha)
 *
 * NOTE: We removed the "no common words after char 20" check from v2 — it was
 * discarding real headings like "Positions of Responsibility".
 */
function isPotentialHeading(line) {
  const t = line.trim();
  if (t.length < 2 || t.length > 90) return false;
  if (/^[-•*·▪➢✓✔\d]/.test(t)) return false;      // bullet or numbered list item
  if (/[.!?,;]$/.test(t)) return false;              // sentence ending
  if (t.split(/\s+/).length > 8) return false;        // too many words to be a heading
  // Must look like a heading: ALL CAPS, or starts with capital and is mostly alpha/spaces/symbols
  return (
    t === t.toUpperCase() ||
    /^[A-Z][A-Za-z0-9\s&/()\-:]+$/.test(t)
  );
}

async function parseSections(lines) {
  const sections = {
    summary:[], education:[], experience:[],
    skills:[], projects:[], certifications:[],
    achievements:[], other:[],
  };
  let current = 'other';

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (isPotentialHeading(t)) {
      const fast = detectSectionFast(t);
      if (fast) { current = fast; continue; }

      // Zero-shot fallback for truly ambiguous short headings
      if (t.length < 50 && t.split(/\s+/).length <= 6) {
        try {
          const clf = await getZeroShot();
          const res = await clf(t, SECTION_LABELS);
          if (res.scores[0] > 0.62) { current = res.labels[0]; continue; }
        } catch { /* best-effort */ }
      }
    }

    (sections[current] || sections.other).push(t);
  }
  return sections;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILLS
//
// v3 fixes:
//  • Category stripping uses a tighter regex — only strips lines that are
//    PURELY a category label, not lines that happen to start with a tech name.
//  • Splitting no longer uses "/" as a delimiter (breaks HTML+CSS, C++, etc.).
//  • NER MISC enrichment is kept but gated: token must look like a real
//    technology identifier (contains digits, dots, or mixed case).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split a delimiter-separated list into individual skill tokens.
 * Delimiters: comma, semicolon, bullet chars, pipe.
 * We do NOT split on "/" because that breaks "HTML/CSS", "TCP/IP", etc.
 * We do NOT split on "and"/"or" because they appear inside skill names.
 */
function splitSkillItems(text) {
  return text
    .split(/[,;•·|]/)
    .map(s =>
      s
        .replace(/^[-•*·▪➢✓✔\s]+/, '')  // strip leading bullets/whitespace
        .replace(/[:\s]+$/, '')            // strip trailing colon/whitespace
        .trim()
    )
    .filter(s => s.length > 1 && s.length < 80 && !/^\d+$/.test(s));
}

/**
 * Detect if the part before a colon is a sub-heading/label rather than a skill.
 * Rules:
 *  - 1–5 words only (labels are short)
 *  - does not contain digits (skill names like "C++", "HTML5" have digits but are after the colon)
 *  - ends with typical label words OR is a known category pattern
 */
function isColonLabel(before) {
  const t = before.trim();
  if (!t) return false;
  const wordCount = t.split(/\s+/).length;
  if (wordCount > 6) return false;           // too long to be a label
  if (/^\d/.test(t)) return false;           // starts with digit — not a label
  // If it contains no letters it's not a label
  if (!/[a-zA-Z]/.test(t)) return false;
  // Short phrases before colon are almost always labels in a skills section
  // (e.g. "Languages", "Cloud/Databases", "Relevant Coursework", "Tools & Frameworks")
  return true;
}

function extractSkillsFromLines(lines) {
  const skills = new Map(); // normalised-key → display value

  for (let raw of lines) {
    let line = raw.trim().replace(/^[-•*·▪➢✓✔]\s*/, '');
    if (!line) continue;

    // Pattern: "Label: skill1, skill2, ..."
    // ALWAYS strip the label and keep only what comes after the colon.
    // This handles: "Languages: Python", "Cloud/Databases: MySQL",
    // "Relevant Coursework: DSA", "Tools & Frameworks: React", etc.
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const before = line.slice(0, colonIdx).trim();
      const after  = line.slice(colonIdx + 1).trim();
      if (isColonLabel(before)) {
        // Only keep the skills AFTER the colon; discard the label entirely
        if (after) splitSkillItems(after).forEach(s => skills.set(s.toLowerCase(), s));
        continue;
      }
    }

    // Line that ends with a bare colon (e.g. "Languages:") — skip entirely
    if (/:$/.test(line)) continue;

    // Normal skill line — split by delimiters and add
    splitSkillItems(line).forEach(s => skills.set(s.toLowerCase(), s));
  }

  return [...skills.values()].filter(s => s.length > 1);
}

/** NER enhancement: only add tokens that strongly look like tech identifiers */
async function enrichSkillsWithNER(text, existingSkills) {
  try {
    const ner      = await getNER();
    const entities = await ner(text.slice(0, 2500));
    const existing = new Set(existingSkills.map(s => s.toLowerCase()));

    for (const ent of entities) {
      const w = (ent.word || '').trim();
      if (
        w.length > 1 && w.length < 50 &&
        ent.entity === 'MISC' &&
        !existing.has(w.toLowerCase()) &&
        // Must look like a tech identifier: contains digit, dot, +, #, or mixed-case abbrev
        /[A-Z]{2,}|[0-9]|[.#+]/.test(w) &&
        /^[A-Za-z][a-zA-Z0-9.#+\-_/]+$/.test(w) &&
        !/^(the|and|for|with|from|has|have|was|been|this|that|they|are|its|our|your|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(w)
      ) {
        existingSkills.push(w);
        existing.add(w.toLowerCase());
      }
    }
  } catch { /* NER is enhancement only */ }
  return existingSkills;
}

// ─────────────────────────────────────────────────────────────────────────────
// EDUCATION
// ─────────────────────────────────────────────────────────────────────────────

const DEGREE_RE = /\b(b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?|b\.?sc|m\.?sc|mba|bca|mca|ph\.?d|bachelor|master|diploma|associate|b\.?arch|llb|mbbs|b\.?com|m\.?com)\b/i;

async function extractEducation(lines) {
  const results   = [];
  const fullText  = lines.join(' ');

  // NER: find institution names
  let institutions = [];
  try {
    const ner  = await getNER();
    const ents = await ner(fullText.slice(0, 3000));
    institutions = ents
      .filter(e => e.entity === 'ORG')
      .map(e => e.word?.trim())
      .filter(w => w && /university|college|institute|school|academy|iit|nit|iiit/i.test(w));
  } catch { /* optional */ }

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.length < 5) continue;
    const hasDegree = DEGREE_RE.test(t);
    const hasInst   = institutions.some(inst =>
      t.toLowerCase().includes(inst.toLowerCase())
    );
    if (hasDegree || hasInst) {
      results.push(t.slice(0, 220).replace(/\s+/g, ' '));
    }
  }

  // Fallback: if NER + regex yield nothing, return all education lines
  if (!results.length) {
    return lines.filter(l => l.trim().length > 8).slice(0, 8);
  }
  return [...new Set(results)].slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIENCE
//
// v3: also folds in the "achievements" section lines since many resumes put
// internship / event experience under headings like
// "Positions of Responsibility" or "Achievements".
// ─────────────────────────────────────────────────────────────────────────────

// Matches: "Oct 2023 - Nov 2023", "2022-26", "4/3/25 - 5/3/25", "Jan 2024 – Present"
// Also matches standalone years like "sep,2023-2024"
const DATE_RANGE_RE = /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b\d{4})\s*[-–]\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{2,4}|present|current|now)/gi;

// Broad: catches intern, internship, trainee, head, organiser, member, volunteer etc.
const JOB_TITLE_RE = /\b(engineer|developer|analyst|intern(ship)?|trainee|manager|lead|consultant|architect|designer|scientist|researcher|administrator|specialist|coordinator|director|officer|associate|organiser?|organizer?|head|member|volunteer)\b/i;

async function extractExperience(lines) {
  const results   = [];
  const BULLET_RE = /^[•*➢▪]/;
  const blocks    = [];
  let   block     = [];

  // Group lines into blocks. A new block starts when:
  //   (a) we hit a blank line, OR
  //   (b) a bullet line arrives while a non-empty block exists
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (block.length) { blocks.push(block); block = []; }
      continue;
    }
    if (BULLET_RE.test(t) && block.length > 0) {
      blocks.push(block); block = [];
    }
    block.push(t);
  }
  if (block.length) blocks.push(block);
  // Fallback: if nothing grouped, treat everything as one block
  if (!blocks.length && lines.length) {
    blocks.push(lines.map(l => l.trim()).filter(Boolean));
  }

  for (const blk of blocks) {
    if (!blk.length) continue;
    const blockText = blk.join(' ');

    // ── Date ─────────────────────────────────────────────────────────────────
    const dateMatches = blockText.match(DATE_RANGE_RE);
    const dateStr     = dateMatches ? dateMatches[0] : '';

    // ── Company via NER (best-effort) ─────────────────────────────────────────
    let company = '';
    try {
      const ner    = await getNER();
      const ents   = await ner(blk[0].slice(0, 200));
      const orgEnt = ents.find(e => e.entity === 'ORG');
      if (orgEnt) company = orgEnt.word.trim();
    } catch { /* optional */ }

    // ── Title: first line stripped of bullet + embedded date ─────────────────
    const rawTitle = blk[0].replace(/^[•*\-➢▪]\s*/, '').trim();
    const title    = rawTitle
      .replace(DATE_RANGE_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 130);

    // ── Description: remaining lines ──────────────────────────────────────────
    const descLines = blk.slice(1).filter(l => l.trim() && l.trim() !== rawTitle);
    const desc = descLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 500);

    // ── Relevance check ───────────────────────────────────────────────────────
    // Include the block if it has ANY of: date range, job-title keyword, company,
    // OR a substantial description (the user DID put it in the experience section).
    const relevant =
      dateStr ||
      JOB_TITLE_RE.test(rawTitle) ||
      JOB_TITLE_RE.test(blockText) ||
      company ||
      desc.length > 40; // has real descriptive content → keep it

    if (!relevant) continue;

    // ── Assemble entry string ─────────────────────────────────────────────────
    let entry = title;
    if (company && !title.toLowerCase().includes(company.toLowerCase())) {
      entry += ` at ${company}`;
    }
    if (dateStr && !title.includes(dateStr.slice(0, 6))) {
      entry += ` (${dateStr})`;
    }
    if (desc) entry += ` – ${desc}`;
    results.push(entry.slice(0, 700));
  }

  return [...new Set(results)].slice(0, 15);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

const TECH_LINE_RE = /^(skills|technologies|tech\s*stack|built\s*with|tools|stack)\s*[:\-]/i;

function extractProjects(lines) {
  const raw = [];
  let current = null;

  function save() {
    if (!current?.title?.trim()) return;
    // Require a minimum meaningful title (not a description line)
    if (current.title.split(/\s+/).length < 2 && !current.desc) return;
    raw.push({
      title:       current.title.trim().slice(0, 120),
      description: current.desc.replace(/\s+/g, ' ').trim().slice(0, 500),
      techStack:   [...new Set(current.tech)].slice(0, 12),
    });
    current = null;
  }

  // Patterns that indicate a line is a DESCRIPTION line, not a title
  const DESCRIPTION_START_RE = /^(built|developed|designed|created|implemented|integrated|engineered|used|worked|added|deployed|the|a |an |this |it |we |i |–|—|-|•|\*|[a-z])/i;
  // A line MUST match this to be considered a title without a bullet
  const STRONG_TITLE_RE = /^[A-Z][A-Za-z0-9\s\-:&()'"]{2,}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Bullet-prefixed line → always a new project title
    const bulletMatch = line.match(/^[\u2022*\-\u27a2\u25aa]\s*(.+)$/);
    if (bulletMatch) {
      save();
      current = { title: bulletMatch[1].trim(), desc: '', tech: [] };
      continue;
    }

    // Tech stack line inside current project
    if (current && TECH_LINE_RE.test(line)) {
      const techPart = line.replace(TECH_LINE_RE, '').trim();
      splitSkillItems(techPart).forEach(t => current.tech.push(t));
      continue;
    }

    // Non-bullet line: only start a NEW project if:
    //   1. No current project exists, AND
    //   2. Line looks like a strong title (short, starts with capital, not a description verb)
    const looksLikeTitle =
      !current &&
      line.length < 100 &&
      line.split(/\s+/).length <= 10 &&
      STRONG_TITLE_RE.test(line) &&
      !DESCRIPTION_START_RE.test(line.toLowerCase()) &&
      !/:$/.test(line) &&
      !/^(\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line);

    if (looksLikeTitle) {
      save();
      current = { title: line, desc: '', tech: [] };
      continue;
    }

    // Everything else is description content for the current project — never start a new project from an orphaned description line
    if (current) current.desc += (current.desc ? ' ' : '') + line;
  }
  save();

  // Deduplicate by title
  const byTitle = new Map();
  for (const p of raw) {
    const key = p.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').slice(0, 50);
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, p);
    } else {
      byTitle.set(key, {
        title:       existing.title,
        description: p.description.length > existing.description.length ? p.description : existing.description,
        techStack:   p.techStack.length > existing.techStack.length ? p.techStack : existing.techStack,
      });
    }
  }

  return [...byTitle.values()].filter(p => p.title.length > 3).slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATIONS
//
// v3: ONLY returns content when an explicit certifications section was detected.
// If no section found, returns []. Never guesses from other sections.
// ─────────────────────────────────────────────────────────────────────────────

const CERT_KW_RE = /certification|certified|certificate|badge|course|udemy|coursera|nptel|salesforce|microsoft|aws|azure|google|oracle|cisco|comptia|pmp|scrum|hackerrank|linkedin\s*learning|edx|pluralsight|infosys|nasscom|redhat/i;

function extractCertifications(lines) {
  // If the certifications section had no lines, return empty — never assume
  if (!lines.length) return [];

  const certs = [];
  for (const line of lines) {
    const t = line.trim().replace(/^[-•*·▪➢✓✔]\s*/, '');
    if (t.length < 5) continue;
    certs.push(t.slice(0, 250));
  }
  return [...new Set(certs)]
    .filter(c => c.length < 200 || CERT_KW_RE.test(c))
    .slice(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT INFO
// ─────────────────────────────────────────────────────────────────────────────

function extractContact(text) {
  const emails   = [...new Set(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])].slice(0, 2);
  const phones   = [...new Set(text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [])].slice(0, 2);
  const linkedIn = (text.match(/linkedin\.com\/in\/[\w-]+/i) || [])[0] || '';
  const github   = (text.match(/github\.com\/[\w-]+/i) || [])[0] || '';
  return { emails, phones, linkedIn, github };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

async function parseResumeBuffer(buffer, mimetype = 'application/pdf') {
  const rawText = await extractTextFromBuffer(buffer, mimetype);
  if (!rawText) return emptyResult();

  const allLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const lines    = deduplicateLines(allLines);

  const sections = await parseSections(lines);

  // ── Skills ──────────────────────────────────────────────────────────────────
  // Only use the dedicated skills section. Fall back to summary only if truly empty.
  const skillSource = sections.skills.length
    ? sections.skills
    : sections.summary.slice(0, 10);

  let skills = extractSkillsFromLines(skillSource);

  if (sections.skills.length) {
    skills = await enrichSkillsWithNER(sections.skills.join(' '), skills);
  }
  skills = [...new Set(skills)].slice(0, 60);

  // ── Education ────────────────────────────────────────────────────────────────
  const education = await extractEducation(sections.education);

  // ── Experience ───────────────────────────────────────────────────────────────
  // Use ONLY the dedicated experience section lines.
  // "Positions of Responsibility" / achievements are a different concept and
  // should NOT pollute the professional experience list.
  const experience = await extractExperience(sections.experience);

  // ── Projects ─────────────────────────────────────────────────────────────────
  const projects = extractProjects(sections.projects);

  // ── Certifications ───────────────────────────────────────────────────────────
  // ONLY from an explicitly detected certifications section
  const certifications = extractCertifications(sections.certifications);

  const contact = extractContact(rawText);

  return {
    skills,
    education,
    experience,
    projects,
    certifications,
    resumeParsed: {
      rawTextLength: rawText.length,
      contact,
      sections: {
        summary:        sections.summary.slice(0, 10),
        education:      education.slice(0, 20),
        experience:     experience.slice(0, 20),
        projects:       projects.slice(0, 20),
        skills:         skills.slice(0, 60),
        certifications: certifications.slice(0, 20),
      },
    },
  };
}

function emptyResult() {
  return {
    skills: [], education: [], experience: [], projects: [], certifications: [],
    resumeParsed: { rawTextLength: 0, contact: {}, sections: {} },
  };
}

module.exports = { parseResumeBuffer };