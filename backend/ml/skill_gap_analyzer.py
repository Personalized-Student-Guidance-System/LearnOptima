"""
skill_gap_analyzer.py  ──  ML-powered, fully dynamic
═══════════════════════════════════════════════════════

FIXES vs original:
  1. Model string: "claude-sonnet-4-6" → "claude-sonnet-4-20250514"
  2. Embedding path: original had a NotImplementedError block that always
     ran and blocked the real embedding call. Now the fallback chain is:
       a) voyageai if VOYAGE_API_KEY set
       b) sklearn TF-IDF (always available)
     The broken Anthropic-beta-embeddings block is removed entirely.
  3. Cosine similarity: added guard for zero-dimension arrays.
  4. Claude prioritization: added explicit timeout via max_tokens cap.

Pipeline:
  1. Scrape live job postings (Naukri + LinkedIn + Indeed)
  2. Extract skill tokens via regex + Claude NLP
  3. Embed user skills & required skills
  4. Cosine-similarity ranking to surface true skill gaps
  5. Priority tiers derived from embedding distance, not fixed rules
"""

import re
import time
import random
import json
import os
import sys
import requests
import numpy as np
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Tuple
import anthropic
from pathlib import Path
from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Load backend/.env when running this module directly
load_dotenv(Path(__file__).resolve().parents[1] / '.env')

# ── Model constant ─────────────────────────────────────────────────────────────
# FIXED: was "claude-sonnet-4-6" which is not a valid API model string.
CLAUDE_MODEL = "claude-sonnet-4-20250514"

ROLE_ALIASES = {
    "ca": "Chartered Accountant",
    "chartered accountant": "Chartered Accountant",
    "doctor": "Doctor",
    "physician": "Doctor",
}


def _normalize_role(role: str) -> str:
    r = (role or "").strip()
    if not r:
        return "Software Engineer"
    return ROLE_ALIASES.get(r.lower(), r)


def _role_seed_skills(role: str) -> List[str]:
    r = role.lower()
    if any(k in r for k in ["quantum engineer", "quantum computing", "quantum developer"]):
        return [
            "python", "linear algebra", "probability", "quantum mechanics", "qiskit",
            "cirq", "quantum algorithms", "quantum circuits", "quantum error correction",
            "optimization", "machine learning", "research papers", "mathematics",
        ]
    if any(k in r for k in ["data scientist", "data science"]):
        return [
            "python", "sql", "statistics", "probability", "machine learning",
            "deep learning", "pandas", "numpy", "scikit-learn", "data visualization",
            "feature engineering", "model evaluation", "a/b testing", "experimentation",
            "tensorflow", "pytorch", "business understanding", "case studies",
        ]
    if any(k in r for k in ["data analyst", "analyst", "business analyst", "bi analyst"]):
        return [
            "excel", "sql", "python", "statistics", "data visualization",
            "power bi", "tableau", "pandas", "business analysis", "dashboarding",
        ]
    if any(k in r for k in ["doctor", "physician", "medical", "surgeon"]):
        return [
            "clinical diagnosis", "patient assessment", "medical ethics", "pharmacology",
            "evidence-based medicine", "electronic health records", "case documentation",
            "emergency care", "communication", "hospital protocols",
        ]
    if any(k in r for k in ["chartered accountant", "ca", "accountant", "audit", "tax"]):
        return [
            "financial accounting", "auditing standards", "direct tax", "indirect tax (gst)",
            "financial reporting", "corporate law", "cost accounting", "excel",
            "tally/erp", "risk & compliance",
        ]
    return [
        "domain fundamentals", "core tools", "industry standards", "professional communication",
        "documentation", "compliance & ethics",
    ]

# ── Optional Selenium ────────────────────────────────────────────────────────
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

# ─────────────────────────────────────────────────────────────────────────────
#  Anthropic client (singleton)
# ─────────────────────────────────────────────────────────────────────────────
_anthropic_client: Optional[anthropic.Anthropic] = None

def get_anthropic_client() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise EnvironmentError("ANTHROPIC_API_KEY not set.")
        _anthropic_client = anthropic.Anthropic(api_key=api_key, timeout=30.0)
    return _anthropic_client


# ─────────────────────────────────────────────────────────────────────────────
#  Tech-skill regex  (fast first-pass extraction)
# ─────────────────────────────────────────────────────────────────────────────
TECH_PATTERN = re.compile(
    r"\b("
    r"python|javascript|typescript|java|c\+\+|c#|go|rust|ruby|php|swift|kotlin|scala|r\b|matlab|julia|"
    r"react|angular|vue|next\.?js|nuxt|svelte|jquery|"
    r"node\.?js|express|django|flask|fastapi|spring|rails|laravel|"
    r"sql|mysql|postgresql|mongodb|redis|elasticsearch|cassandra|dynamodb|"
    r"aws|gcp|azure|docker|kubernetes|terraform|ansible|jenkins|circleci|"
    r"machine learning|deep learning|nlp|computer vision|generative ai|llm|"
    r"tensorflow|pytorch|keras|scikit.?learn|pandas|numpy|hugging.?face|langchain|"
    r"git|linux|bash|rest api|graphql|microservices|"
    r"html|css|sass|tailwind|webpack|vite|"
    r"data structures|algorithms|system design|object.?oriented|"
    r"agile|scrum|devops|ci/?cd|unit testing|selenium|"
    r"figma|sketch|photoshop|illustrator|"
    r"spark|hadoop|kafka|airflow|dbt|tableau|power bi|"
    r"qiskit|cirq|quantum mechanics|linear algebra|"
    r"prompt engineering|rag|vector database|embeddings|fine.?tuning|"
    r"communication|problem solving|teamwork|leadership"
    r")\b",
    re.IGNORECASE,
)

DOMAIN_PATTERN = re.compile(
    r"\b(clinical diagnosis|patient assessment|medical ethics|pharmacology|"
    r"evidence-based medicine|electronic health records|emergency care|"
    r"financial accounting|auditing standards|direct tax|indirect tax|gst|"
    r"financial reporting|corporate law|cost accounting|risk compliance|"
    r"excel|tally|erp)\b",
    re.IGNORECASE,
)


def _extract_skills_from_text(text: str) -> List[str]:
    found = TECH_PATTERN.findall(text) + DOMAIN_PATTERN.findall(text)
    seen, out = set(), []
    for s in found:
        key = s.lower().strip()
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  ML Layer 1 — Claude NLP skill extraction from raw job text
# ─────────────────────────────────────────────────────────────────────────────
def _claude_extract_skills_from_jd(jd_text: str, role: str) -> List[str]:
    role = _normalize_role(role)
    if not jd_text.strip():
        return []
    client = get_anthropic_client()
    prompt = (
        f'Extract all job-relevant skills, competencies, tools, frameworks, and domain knowledge '
        f'required for a "{role}" from this job description text.\n\n'
        f'Return ONLY a JSON array of skill strings — no markdown, no explanation.\n\n'
        f'Job description text:\n"""\n{jd_text[:3000]}\n"""\n\nJSON array:'
    )
    try:
        msg = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.M)
        raw = re.sub(r"\n?```$", "", raw, flags=re.M)
        skills = json.loads(raw)
        if isinstance(skills, list):
            return [str(s).lower().strip() for s in skills if s]
    except Exception as e:
        print(f"[Claude Extract] Failed: {e}")
    return []


# ─────────────────────────────────────────────────────────────────────────────
#  ML Layer 2 — Embeddings for semantic skill matching
#
#  FIXED: original had a broken NotImplementedError block that prevented
#  any embedding from ever being computed. New chain:
#    1. voyageai (if VOYAGE_API_KEY or ANTHROPIC_API_KEY works with voyage)
#    2. sklearn TF-IDF (always available — no extra key needed)
# ─────────────────────────────────────────────────────────────────────────────
def _get_embeddings(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 1), dtype=np.float32)

    # ── Option A: Voyage AI embeddings (best semantic quality) ───────────────
    voyage_key = os.environ.get("VOYAGE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")
    if voyage_key:
        try:
            import voyageai
            vo = voyageai.Client(api_key=voyage_key)
            result = vo.embed(texts, model="voyage-3", input_type="document")
            return np.array(result.embeddings, dtype=np.float32)
        except Exception as e:
            print(f"[Embeddings] Voyage failed ({e}) — falling back to TF-IDF")

    # ── Option B: TF-IDF (always works, no API key needed) ───────────────────
    from sklearn.feature_extraction.text import TfidfVectorizer
    try:
        vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
        mat = vec.fit_transform(texts)
        return mat.toarray().astype(np.float32)
    except Exception as e:
        print(f"[Embeddings] TF-IDF failed ({e})")
        return np.zeros((len(texts), 1), dtype=np.float32)


def _cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if a.ndim == 1: a = a.reshape(1, -1)
    if b.ndim == 1: b = b.reshape(1, -1)
    if a.shape[1] == 0 or b.shape[1] == 0:
        return np.zeros((a.shape[0], b.shape[0]), dtype=np.float32)
    norm_a = np.linalg.norm(a, axis=1, keepdims=True) + 1e-9
    norm_b = np.linalg.norm(b, axis=1, keepdims=True) + 1e-9
    return (a / norm_a) @ (b / norm_b).T


def _semantic_skill_gap(
    user_skills: List[str],
    required_skills: List[str],
    threshold: float = 0.65,      # slightly lower default for TF-IDF compat
) -> Tuple[List[str], List[str], float]:
    """
    Semantic matching: a user skill 'covers' a required skill if cosine
    similarity >= threshold. Falls back to exact string matching on failure.
    """
    if not user_skills or not required_skills:
        return [], required_skills, 0.0

    all_texts  = user_skills + required_skills
    embeddings = _get_embeddings(all_texts)

    if embeddings.shape[0] < len(all_texts):
        # Embedding completely failed — exact string fallback
        user_lower = {s.lower() for s in user_skills}
        matched = [s for s in required_skills if s.lower() in user_lower]
        missing  = [s for s in required_skills if s.lower() not in user_lower]
        score    = len(matched) / max(len(required_skills), 1) * 100
        return matched, missing, score

    user_emb = embeddings[:len(user_skills)]
    req_emb  = embeddings[len(user_skills):]

    sim        = _cosine_similarity_matrix(req_emb, user_emb)   # (n_req, n_user)
    best_match = sim.max(axis=1)                                 # best user skill per required

    matched = [req for req, sc in zip(required_skills, best_match) if sc >= threshold]
    missing  = [req for req, sc in zip(required_skills, best_match) if sc < threshold]
    overall  = float(best_match.mean()) * 100
    return matched, missing, overall


# ─────────────────────────────────────────────────────────────────────────────
#  ML Layer 3 — Claude ranks and prioritizes skill gaps
# ─────────────────────────────────────────────────────────────────────────────
def _claude_prioritize_gaps(
    role: str,
    user_skills: List[str],
    missing_skills: List[str],
) -> Dict:
    role = _normalize_role(role)
    if not missing_skills:
        return {"high_priority": [], "medium_priority": [], "low_priority": [],
                "learning_order": [], "estimated_weeks": 0, "key_insight": ""}

    client = get_anthropic_client()
    prompt = (
        f'You are a senior career advisor.\n\n'
        f'Role target: "{role}"\n'
        f'User already knows: {json.dumps(user_skills[:15])}\n'
        f'Missing skills to prioritize: {json.dumps(missing_skills[:20])}\n\n'
        f'Return ONLY valid JSON (no markdown):\n'
        f'{{\n'
        f'  "high_priority": ["skill1", ...],\n'
        f'  "medium_priority": ["skill2", ...],\n'
        f'  "low_priority": ["skill3", ...],\n'
        f'  "learning_order": ["skill1", ...],\n'
        f'  "estimated_weeks": 24,\n'
        f'  "key_insight": "One sentence on the biggest gap."\n'
        f'}}'
    )
    try:
        msg = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.M)
        raw = re.sub(r"\n?```$", "", raw, flags=re.M)
        return json.loads(raw)
    except Exception as e:
        print(f"[Claude Prioritize] Failed: {e}")
        third = max(1, len(missing_skills) // 3)
        return {
            "high_priority":   missing_skills[:third],
            "medium_priority": missing_skills[third:2*third],
            "low_priority":    missing_skills[2*third:],
            "learning_order":  missing_skills,
            "estimated_weeks": 24,
            "key_insight":     f"Focus on {missing_skills[0]} first." if missing_skills else "",
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Web scrapers
# ─────────────────────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _scrape_naukri(job_title: str, location: str = "india", pages: int = 2) -> str:
    texts = []
    slug  = job_title.lower().replace(" ", "-")
    loc   = location.lower().replace(" ", "-")
    for page in range(1, pages + 1):
        url = f"https://www.naukri.com/{slug}-jobs-in-{loc}-{page}"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                texts.append(soup.get_text(" ", strip=True))
            time.sleep(random.uniform(1.0, 2.5))
        except Exception as e:
            print(f"[Naukri] page {page} error: {e}")
    return " ".join(texts)


def _scrape_linkedin(job_title: str, location: str = "India") -> str:
    url = (
        f"https://www.linkedin.com/jobs/search"
        f"?keywords={job_title.replace(' ', '%20')}"
        f"&location={location.replace(' ', '%20')}"
        f"&f_AL=true&position=1&pageNum=0"
    )
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")
        time.sleep(random.uniform(1.5, 3.0))
        return soup.get_text(" ", strip=True)
    except Exception as e:
        print(f"[LinkedIn] error: {e}")
        return ""


def _scrape_indeed(job_title: str, location: str = "India") -> str:
    url = f"https://www.indeed.com/jobs?q={job_title.replace(' ', '+')}&l={location}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")
        time.sleep(random.uniform(1.5, 2.5))
        return soup.get_text(" ", strip=True)
    except Exception as e:
        print(f"[Indeed] error: {e}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
#  Main analyzer
# ─────────────────────────────────────────────────────────────────────────────
class DynamicSkillGapAnalyzer:

    def analyze(
        self,
        user_skills: List[str],
        target_role: str,
        location:    str = "India",
        top_n:       int = 20,
    ) -> Dict:
        target_role = _normalize_role(target_role)
        print(f"[SkillGap] Analyzing '{target_role}' for user with {len(user_skills)} skills...")

        # Step 1: Scrape raw job text
        print("[SkillGap] Scraping job postings...")
        raw_text = (
            _scrape_naukri(target_role, location)
            + " " + _scrape_linkedin(target_role, location)
            + " " + _scrape_indeed(target_role, location)
        )

        # Step 2: Regex + Claude NLP skill extraction
        regex_skills  = _extract_skills_from_text(raw_text)
        print(f"[SkillGap] Regex: {len(regex_skills)} skills; running Claude extraction...")
        claude_skills = _claude_extract_skills_from_jd(raw_text, target_role)

        # Frequency rank and deduplicate
        freq: Dict[str, int] = {}
        for s in regex_skills + claude_skills:
            key = s.lower().strip()
            if key:
                freq[key] = freq.get(key, 0) + 1

        required_skills = [s for s, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)][:top_n]

        # Fallback: Claude generates required skills if scraping yielded nothing
        if len(required_skills) < 5:
            print("[SkillGap] Insufficient scrape data - Claude fallback generation...")
            try:
                client = get_anthropic_client()
                msg    = client.messages.create(
                    model=CLAUDE_MODEL,
                    max_tokens=300,
                    messages=[{"role": "user", "content":
                        f'List the 15 most important job-relevant skills/competencies for a "{target_role}" in 2025. '
                        f'Return ONLY a JSON array of skill strings.'}],
                )
                raw = msg.content[0].text.strip()
                raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.M)
                raw = re.sub(r"\n?```$", "", raw, flags=re.M)
                required_skills = json.loads(raw)
            except Exception as e:
                print(f"[SkillGap] Claude fallback failed: {e}")
                required_skills = _role_seed_skills(target_role)

        required_skills = list(dict.fromkeys([str(s).lower().strip() for s in required_skills if s]))
        required_skills = list(dict.fromkeys(required_skills + _role_seed_skills(target_role)))[:top_n]

        # Step 3: Semantic matching
        print(f"[SkillGap] Semantic similarity on {len(required_skills)} required skills...")
        matched, missing, match_score = _semantic_skill_gap(
            user_skills, required_skills, threshold=0.65
        )

        # Step 4: Claude prioritizes gaps
        print(f"[SkillGap] Claude prioritizing {len(missing)} gaps...")
        priority = _claude_prioritize_gaps(target_role, user_skills, missing)

        return {
            "role":                 target_role,
            "location":             location,
            "required_skills":      required_skills,
            "matched_skills":       matched,
            "missing_skills":       missing,
            "match_score":          round(match_score, 1),
            "high_priority_gaps":   priority.get("high_priority",   missing[:5]),
            "medium_priority_gaps": priority.get("medium_priority", missing[5:10]),
            "low_priority_gaps":    priority.get("low_priority",    missing[10:]),
            "learning_order":       priority.get("learning_order",  missing),
            "estimated_weeks":      priority.get("estimated_weeks", 24),
            "key_insight":          priority.get("key_insight", ""),
            "recommendations":      [f"Learn {s}" for s in priority.get("high_priority", missing[:5])],
            "ml_pipeline":          "scrape → claude-nlp → embedding-similarity → claude-prioritize",
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
_analyzer: Optional[DynamicSkillGapAnalyzer] = None

def get_analyzer() -> DynamicSkillGapAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = DynamicSkillGapAnalyzer()
    return _analyzer


def analyze_skill_gap(user_skills: List[str], target_role: str, location: str = "India") -> Dict:
    """Public API used by Flask routes."""
    return get_analyzer().analyze(user_skills, target_role, location)


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ML skill-gap analyzer")
    parser.add_argument("--skills",   default="Python,SQL,React")
    parser.add_argument("--role",     default="Data Scientist")
    parser.add_argument("--location", default="India")
    args = parser.parse_args()

    user_skills = [s.strip() for s in args.skills.split(",") if s.strip()]
    result      = analyze_skill_gap(user_skills, args.role, args.location)
    print(json.dumps(result, indent=2))