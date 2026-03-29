const { extractTextFromPdfBuffer } = require('./pdfText');

/**
 * Regulation / university syllabus PDFs (e.g. R-22): course codes (22ADC12), UNIT-I/II,
 * Course Objectives / Outcomes, topic lines. Node-only.
 */

const BOILERPLATE =
  /^(information technology|chaitanya|bharathi|institute of technology|department of|semester|regulation|\(r22|aicte|inline with|model curriculum|with effect|scheme of|instruction|examination|credits|hours per|maximum marks|theory|practicals|professional elective|total|l:\s*lecture|cie:|see:|s\.?\s*no\.?|course\s*code|title of the course|code title|duration of see|employability skills|up-skill|--\s*\d+\s+of\s+\d+\s*--)$/i;

const BOILERPLATE_SUBSTR = /(chaitanya|bharathi institute|inline with aicte|model curriculum|with effect from|institute of technology \(a\))/i;

const NOISE_TOPIC =
  /^(page\s*\d+|fig\.|figure|reference|bloom|co-po|articulation|matrix|po\/pso|course\s*outcomes?\s*:|course\s*objectives?\s*:|this course aims|upon completion)/i;

/** Lines between course title and UNIT-I */
const METADATA_LINE =
  /^(instruction|duration|see\s|cie\s|credits|marks|hours per week|scheme of|maximum marks|\d+\s*marks)$/i;

const SKIP_TOPIC =
  /^(total|hours?|l\s*t\s*p|ltp|branch|assessment|question\s*paper)$/i;

/** e.g. 22ADC12, 22ITC13, 22EGC03 */
const COURSE_CODE_STANDALONE = /^(\d{2}[A-Z]{2,5}\d{2,4}[A-Z]?)\s*$/;

/** Table row: "1 22ADC12 Big Data Analytics 3 - - 3 ..." */
const TABLE_ROW = /^(\d{1,2})\s+(\d{2}[A-Z]{2,5}\d{2,4}[A-Z]?)\s+(.+)$/;

function normalizeText(raw) {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .trim();
}

function splitLines(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

function extractLeadingCourseCode(nameOrLine) {
  const m = String(nameOrLine || '').match(/^(\d{2}[A-Z]{2,5}\d{2,4}[A-Z]?)\b/);
  return m ? m[1] : null;
}

function isBoilerplate(line) {
  if (line.length < 4) return true;
  if (BOILERPLATE.test(line)) return true;
  if (BOILERPLATE_SUBSTR.test(line)) return true;
  if (METADATA_LINE.test(line)) return true;
  if (/^[\d\s\-–—.:]+$/.test(line) && line.length < 40) return true;
  return false;
}

function isUnitLine(line) {
  const l = line.replace(/^[\s\d\.\)]+/, '');
  return (
    /^unit\s*[-–—]?\s*[ivx\d]+/i.test(l)
    || /^unit\s+[ivx]{1,4}\b/i.test(l)
    || /^(module|chapter)\s*\d+/i.test(l)
  );
}

function stripTableTail(titlePart) {
  let s = titlePart.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s+\d\s*[-–]\s*[-–]\s*\d(\s+\d+)*.*$/i, '').trim();
  s = s.replace(/\s+\d\s+\d+\s+\d+(\s+\d+)*$/i, '').trim();
  const m = s.match(/^(.+?)(\s+\d[\d\s\-–]+\s*$)/);
  if (m && m[1].length > 8) return m[1].trim();
  return s;
}

function parseTableRow(line) {
  const m = line.match(TABLE_ROW);
  if (!m) return null;
  const rest = m[3];
  const title = stripTableTail(rest);
  if (title.length < 4 || /^(theory|practicals|total)$/i.test(title)) return null;
  return { code: m[2], name: `${m[2]} ${title}`.slice(0, 220) };
}

function topicFromLine(line) {
  return line
    .replace(/^\d+(\.\d+)*[\.)]\s*/, '')
    .replace(/^[([]\d+[)\]]\s*/, '')
    .replace(/^[-•*·▪►]\s*/, '')
    .trim();
}

function isTopicLine(line) {
  if (line.length < 8 || line.length > 500) return false;
  if (METADATA_LINE.test(line) || NOISE_TOPIC.test(line) || SKIP_TOPIC.test(line)) return false;
  if (/^co\s*\d+\s/i.test(line)) return false;
  if (COURSE_CODE_STANDALONE.test(line)) return false;
  if (/^(instruction|duration|hours per week|see\s|cie\s|credits|marks)\b/i.test(line)) return false;
  return true;
}

/**
 * subjects: [{ name, chapters: [{ name, topics: string[] }] }]
 */
async function parseSyllabusBuffer(buffer) {
  const raw = await extractTextFromPdfBuffer(buffer);
  const text = normalizeText(raw);
  const lines = splitLines(text);

  const subjects = [];
  let currentSubject = null;
  let currentChapter = null;

  const flushChapter = () => {
    if (currentSubject && currentChapter && (currentChapter.topics.length || currentChapter.name)) {
      currentSubject.chapters.push(currentChapter);
    }
    currentChapter = null;
  };

  const flushSubject = () => {
    flushChapter();
    if (currentSubject && (currentSubject.chapters.length || currentSubject.name)) {
      subjects.push(currentSubject);
    }
    currentSubject = null;
  };

  const startSubject = (name) => {
    flushSubject();
    currentSubject = { name: name.slice(0, 240), chapters: [] };
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (isBoilerplate(line)) {
      i += 1;
      continue;
    }

    // Table rows list many courses in one block; starting a subject per row flushes before UNIT
    // sections exist. Subjects are created from standalone course codes on detail pages only.
    const tableEntry = parseTableRow(line);
    if (tableEntry && tableEntry.name.length > 10) {
      i += 1;
      continue;
    }

    const codeMatch = line.match(COURSE_CODE_STANDALONE);
    if (codeMatch) {
      const code = codeMatch[1];
      if (currentSubject && extractLeadingCourseCode(currentSubject.name) === code) {
        i += 1;
        continue;
      }
      let title = '';
      let j = i + 1;
      while (j < lines.length && j < i + 6) {
        const ln = lines[j];
        if (!ln || isBoilerplate(ln) || isUnitLine(ln) || COURSE_CODE_STANDALONE.test(ln)) break;
        if (parseTableRow(ln)) break;
        if (/^instruction\s|^duration|^see\s|^cie\s|^credits\s/i.test(ln)) break;
        if (ln.length > 3) title += (title ? ' ' : '') + ln;
        j += 1;
        if (title.length > 120) break;
      }
      const name = title ? `${code} ${title}`.slice(0, 240) : code;
      startSubject(name);
      i = j;
      continue;
    }

    if (!currentSubject) {
      i += 1;
      continue;
    }

    if (isUnitLine(line)) {
      flushChapter();
      currentChapter = { name: line.slice(0, 200), topics: [] };
      const rest = line.replace(/^unit\s*[-–—]?\s*[ivx\d]+\s*/i, '').trim();
      if (rest.length > 10) {
        currentChapter.topics.push(topicFromLine(rest));
      }
      i += 1;
      continue;
    }

    if (!currentChapter) {
      if (/objectives?:|outcomes?:/i.test(line)) {
        i += 1;
        continue;
      }
      currentChapter = { name: 'Syllabus content', topics: [] };
    }

    if (isTopicLine(line)) {
      const t = topicFromLine(line);
      if (t.length >= 8 && !isBoilerplate(t)) {
        currentChapter.topics.push(t);
      }
    }

    i += 1;
  }

  flushSubject();

  for (const sub of subjects) {
    const seen = new Set();
    const chs = [];
    for (const ch of sub.chapters) {
      const key = ch.name;
      if (seen.has(key) && (ch.topics || []).length === 0) continue;
      seen.add(key);
      chs.push({ ...ch, topics: [...new Set(ch.topics)].slice(0, 150) });
    }
    sub.chapters = chs;
  }

  if (subjects.length === 0 && lines.length > 0) {
    const filtered = lines
      .filter((l) => l.length >= 6 && l.length < 220 && !isBoilerplate(l))
      .slice(0, 120);
    subjects.push({
      name: 'Extracted syllabus',
      chapters: [{ name: 'Contents', topics: filtered }],
    });
  }

  const flatSubjectNames = [...new Set(subjects.map((s) => s.name).filter(Boolean))];

  return { subjects, flatSubjectNames };
}

module.exports = { parseSyllabusBuffer };
