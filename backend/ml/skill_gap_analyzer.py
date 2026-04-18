"""
skill_gap_analyzer.py  ──  Dynamic ML skill-gap analyzer (Web Scraping + NLP)
═══════════════════════════════════════════════════════════════════════════════

Pipeline:
  1. Check MongoDB/memory cache for role-specific skills
  2. Scrape live job postings (Naukri + LinkedIn + Indeed RSS)
  3. NLP extraction: spaCy NER + noun-phrase chunking + regex + n-grams
  4. Sentence-transformer semantic matching (all-MiniLM-L6-v2)
  5. Frequency-based gap prioritization
  6. Cache results in MongoDB (24h TTL)

Fallback:
  If scraping yields < 5 skills, supplements with seed catalogue.
  If sentence-transformers unavailable, falls back to TF-IDF.
  If spaCy unavailable, uses regex-only extraction.
"""

import re
import time
import random
import json
import os
import sys
import requests
import numpy as np
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from dotenv import load_dotenv
from collections import Counter

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Load backend/.env when running this module directly
load_dotenv(Path(__file__).resolve().parents[1] / '.env')

# ── Import our NLP skill extractor ────────────────────────────────────────────
from skill_extractor import (
    extract_skills_from_text,
    semantic_skill_match,
    get_skill_embeddings,
)
from onet_utils import OnetClient

_onet = OnetClient()


# ─────────────────────────────────────────────────────────────────────────────
#  MongoDB persistent cache for scraped skills
# ─────────────────────────────────────────────────────────────────────────────
_skills_memory_cache: Dict[str, Dict] = {}
_SKILLS_CACHE_TTL = 86400  # 24 hours

_mongo_collection = None
_mongo_connected = False


def _connect_mongo_cache():
    """Connect to MongoDB for persistent skill caching."""
    global _mongo_collection, _mongo_connected
    if _mongo_connected:
        return _mongo_collection
    uri = os.environ.get("MONGO_URI", "")
    if not uri:
        print("[SkillCache] MONGO_URI not set — memory-only cache", file=sys.stderr)
        return None
    try:
        from pymongo import MongoClient
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        coll = client["learnoptima"]["scraped_skills_cache"]
        coll.create_index("cacheKey", unique=True, background=True)
        _mongo_collection = coll
        _mongo_connected = True
        print("[SkillCache] ✓ MongoDB connected", file=sys.stderr)
        return coll
    except Exception as e:
        print(f"[SkillCache] MongoDB failed ({e}) — memory-only", file=sys.stderr)
        return None


def _cache_get(role: str) -> Optional[Dict]:
    """Get cached scraped skills for a role."""
    key = f"skills::{role.lower().strip()}"

    # Memory cache
    if key in _skills_memory_cache:
        entry = _skills_memory_cache[key]
        if time.time() - entry["ts"] < _SKILLS_CACHE_TTL:
            print(f"[SkillCache] Memory HIT: {role}")
            return entry["data"]

    # MongoDB cache
    coll = _connect_mongo_cache()
    if coll is not None:
        try:
            doc = coll.find_one({"cacheKey": key})
            if doc and time.time() - doc.get("ts", 0) < _SKILLS_CACHE_TTL:
                data = doc.get("data", {})
                _skills_memory_cache[key] = {"ts": doc["ts"], "data": data}
                print(f"[SkillCache] MongoDB HIT: {role}")
                return data
        except Exception as e:
            print(f"[SkillCache] Read error: {e}", file=sys.stderr)

    print(f"[SkillCache] MISS: {role}")
    return None


def _cache_set(role: str, data: Dict):
    """Cache scraped skills for a role."""
    key = f"skills::{role.lower().strip()}"
    ts = time.time()
    _skills_memory_cache[key] = {"ts": ts, "data": data}

    coll = _connect_mongo_cache()
    if coll is not None:
        try:
            coll.replace_one(
                {"cacheKey": key},
                {"cacheKey": key, "ts": ts, "data": data},
                upsert=True,
            )
            print(f"[SkillCache] Saved: {role}")
        except Exception as e:
            print(f"[SkillCache] Write error: {e}", file=sys.stderr)


# ─────────────────────────────────────────────────────────────────────────────
#  Role normalization
# ─────────────────────────────────────────────────────────────────────────────
ROLE_ALIASES = {
    "ca": "Chartered Accountant",
    "chartered accountant": "Chartered Accountant",
    "doctor": "Doctor",
    "physician": "Doctor",
    "teacher": "Teacher",
    "educator": "Teacher",
    "lecturer": "Teacher",
    "professor": "Professor",
    "swe": "Software Engineer",
    "frontend": "Frontend Developer",
    "backend": "Backend Developer",
    "devops": "DevOps Engineer",
    "ds": "Data Scientist",
    "da": "Data Analyst",
    "ml engineer": "Machine Learning Engineer",
    "mle": "Machine Learning Engineer",
    "pm": "Product Manager",
    "fullstack": "Full Stack Developer",
    "full-stack": "Full Stack Developer",
    "full stack": "Full Stack Developer",
}


def _normalize_role(role: str) -> str:
    r = (role or "").strip()
    if not r:
        return "Software Engineer"
    return ROLE_ALIASES.get(r.lower(), r)


# ─────────────────────────────────────────────────────────────────────────────
#  Seed skill catalogue (FALLBACK ONLY — used when scraping yields < 5 skills)
# ─────────────────────────────────────────────────────────────────────────────
def _role_seed_skills(role: str) -> List[str]:
    """Fallback seed skills when scraping yields insufficient data."""
    r = role.lower()

    if any(k in r for k in ["teacher", "educator", "tutor", "lecturer", "instructor"]):
        return ["lesson planning", "classroom management", "curriculum development",
                "student assessment", "communication skills", "learning management systems"]
    if any(k in r for k in ["professor", "faculty", "academic"]):
        return ["research & publication", "curriculum design", "academic writing",
                "student mentoring", "grant writing", "pedagogical methods"]
    if any(k in r for k in ["doctor", "physician", "medical", "surgeon"]):
        return ["clinical diagnosis", "patient assessment", "pharmacology",
                "evidence-based medicine", "electronic health records", "emergency care"]
    if any(k in r for k in ["nurse", "nursing"]):
        return ["patient care", "vital signs monitoring", "medication administration",
                "wound care", "infection control", "emergency response"]
    if any(k in r for k in ["chartered accountant", "ca", "accountant", "audit", "tax"]):
        return ["financial accounting", "auditing standards", "direct tax", "indirect tax",
                "financial reporting", "tally/erp", "risk & compliance"]
    if any(k in r for k in ["lawyer", "advocate", "attorney", "legal"]):
        return ["legal research", "legal drafting", "contract law", "litigation",
                "case analysis", "negotiation", "corporate law"]
    if any(k in r for k in ["data scientist", "data science"]):
        return ["python", "sql", "statistics", "machine learning", "pandas", "numpy",
                "scikit-learn", "deep learning", "data visualization"]
    if any(k in r for k in ["software engineer", "developer", "programmer"]):
        return ["python", "javascript", "sql", "git", "react", "node.js",
                "data structures", "algorithms", "system design", "docker"]
    if any(k in r for k in ["marketing", "digital marketing"]):
        return ["seo", "sem", "google analytics", "social media marketing",
                "content marketing", "email marketing", "crm tools"]
    if any(k in r for k in ["security engineer", "cybersecurity", "infosec", "security analyst"]):
        return ["cybersecurity", "network security", "ethical hacking", "siem", "soc",
                "incident response", "vulnerability assessment", "firewalls", "cryptography", "cloud security"]

    # Generic fallback
    return ["communication", "problem solving", "teamwork", "analytical skills",
            "project management"]


# ─────────────────────────────────────────────────────────────────────────────
#  Web scrapers — fetch raw job description text
# ─────────────────────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _scrape_naukri(job_title: str, location: str = "india", pages: int = 2) -> str:
    """Scrape Naukri search results and individual JD pages."""
    texts = []
    slug = job_title.lower().replace(" ", "-")
    loc = location.lower().replace(" ", "-")

    for page in range(1, pages + 1):
        url = f"https://www.naukri.com/{slug}-jobs-in-{loc}-{page}"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                texts.append(soup.get_text(" ", strip=True))

                # Also try to get individual JD links from the page
                jd_links = []
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if "naukri.com/job-listings-" in href or "/job-listings-" in href:
                        full_url = href if href.startswith("http") else f"https://www.naukri.com{href}"
                        jd_links.append(full_url)

                # Fetch up to 3 individual JDs for richer text
                for jd_url in jd_links[:3]:
                    try:
                        jd_resp = requests.get(jd_url, headers=HEADERS, timeout=8)
                        if jd_resp.status_code == 200:
                            jd_soup = BeautifulSoup(jd_resp.text, "html.parser")
                            # Look for JD container
                            jd_div = (
                                jd_soup.find("div", class_=re.compile(r"job-desc|JDContainer|description", re.I))
                                or jd_soup.find("section", class_=re.compile(r"job-desc|description", re.I))
                            )
                            if jd_div:
                                texts.append(jd_div.get_text(" ", strip=True))
                            else:
                                texts.append(jd_soup.get_text(" ", strip=True)[:5000])
                        time.sleep(random.uniform(0.3, 0.8))
                    except Exception:
                        pass

            time.sleep(random.uniform(0.5, 1.5))
        except Exception as e:
            print(f"[Scraper] Naukri page {page} error: {e}", file=sys.stderr)

    return " ".join(texts)


def _scrape_linkedin(job_title: str, location: str = "India") -> str:
    """Scrape LinkedIn public job search page."""
    url = (
        f"https://www.linkedin.com/jobs/search"
        f"?keywords={job_title.replace(' ', '%20')}"
        f"&location={location.replace(' ', '%20')}"
        f"&f_AL=true&position=1&pageNum=0"
    )
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            time.sleep(random.uniform(0.5, 1.0))
            return soup.get_text(" ", strip=True)
    except Exception as e:
        print(f"[Scraper] LinkedIn error: {e}", file=sys.stderr)
    return ""


def _scrape_indeed_rss(job_title: str, location: str = "india") -> str:
    """Scrape Indeed RSS feed (free, no API key needed)."""
    texts = []
    query = job_title.replace(" ", "+")
    loc = location.replace(" ", "+")
    url = f"https://www.indeed.co.in/rss?q={query}&l={loc}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            try:
                root = ET.fromstring(resp.text)
                for item in root.findall(".//item"):
                    desc = item.find("description")
                    title = item.find("title")
                    if desc is not None and desc.text:
                        soup = BeautifulSoup(desc.text, "html.parser")
                        texts.append(soup.get_text(" ", strip=True))
                    if title is not None and title.text:
                        texts.append(title.text)
            except ET.ParseError:
                soup = BeautifulSoup(resp.text, "html.parser")
                texts.append(soup.get_text(" ", strip=True))
    except Exception as e:
        print(f"[Scraper] Indeed RSS error: {e}", file=sys.stderr)
    return " ".join(texts)


def _scrape_google_search(job_title: str, location: str = "India") -> str:
    """Scrape a Google search for '<role> skills required' for supplementary data."""
    texts = []
    queries = [
        f"{job_title} skills required {location}",
        f"{job_title} job description skills",
    ]
    for query in queries:
        url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=8)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                # Get search snippet text
                for div in soup.find_all("div", class_=re.compile(r"BNeawe|VwiC3b", re.I)):
                    texts.append(div.get_text(" ", strip=True))
                # Also get featured snippet if present
                for div in soup.find_all("div", class_=re.compile(r"IZ6rdc|xpdopen", re.I)):
                    texts.append(div.get_text(" ", strip=True))
            time.sleep(random.uniform(0.5, 1.5))
        except Exception as e:
            print(f"[Scraper] Google search error: {e}", file=sys.stderr)
    return " ".join(texts)


# ─────────────────────────────────────────────────────────────────────────────
#  Gap prioritization (frequency + importance based)
# ─────────────────────────────────────────────────────────────────────────────
def _prioritize_gaps(
    role: str,
    missing_skills: List[str],
    freq_map: Dict[str, int],
) -> Dict:
    """Prioritize gaps by scraped frequency."""
    if not missing_skills:
        return {
            "high_priority": [], "medium_priority": [], "low_priority": [],
            "learning_order": [], "estimated_weeks": 0, "key_insight": "",
        }

    # Sort by frequency in scraped results (higher = more important)
    sorted_missing = sorted(
        missing_skills,
        key=lambda x: freq_map.get(x.lower(), freq_map.get(x, 0)),
        reverse=True,
    )

    third = max(1, len(sorted_missing) // 3)
    high_prio = sorted_missing[:third]

    return {
        "high_priority":   high_prio,
        "medium_priority": sorted_missing[third:2*third],
        "low_priority":    sorted_missing[2*third:],
        "learning_order":  sorted_missing,
        "estimated_weeks": max(8, min(52, len(sorted_missing) * 3)),
        "key_insight":     f"Focus on {high_prio[0]} first — highest demand in live job postings." if high_prio else "",
    }


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
        refresh:     bool = False,
    ) -> Dict:
        target_role = _normalize_role(target_role)
        print(f"\n[SkillGap] ═══ Analyzing '{target_role}' for user with {len(user_skills)} skills ═══")

        # ── Step 1: Check cache ──────────────────────────────────────────────
        cached = None if refresh else _cache_get(target_role)
        
        # If O*NET is available but cache is from an old live-scrape, ignore cache to force O*NET
        use_cache = False
        if cached:
            if _onet.available and cached.get("source") != "onet-api":
                print(f"[SkillGap] Ignoring non-O*NET cache for '{target_role}' to favor O*NET")
                use_cache = False
            else:
                use_cache = True
        
        if use_cache and cached:
            freq_map = cached.get("freq_map", {})
            required_skills = cached.get("required_skills", [])
            scrape_source = cached.get("source", "cache")
            print(f"[SkillGap] Using cached {len(required_skills)} skills for '{target_role}' from {scrape_source}")
        else:
            # ── Step 2: Hybrid Pipeline (O*NET Foundations + Modern Scrape) ──
            required_skills = []
            freq_map = {}
            
            # A) Get O*NET foundations
            onet_list = []
            if _onet.available:
                print(f"[SkillGap] Fetching O*NET foundations for '{target_role}'...")
                onet_list = _onet.get_role_skills(target_role)
                for s in onet_list:
                    name = s["name"].lower().strip()
                    score = s.get("score", 3.0)
                    freq_map[name] = int(score * 10)  # High base priority for O*NET
            
            # B) Get modern market skills via scraping
            print(f"[SkillGap] Scraping live job data for modern keywords for '{target_role}'...")
            raw_naukri   = _scrape_naukri(target_role, location)
            raw_linkedin = _scrape_linkedin(target_role, location)
            raw_indeed   = _scrape_indeed_rss(target_role, location)
            raw_google   = _scrape_google_search(target_role, location)

            raw_text = f"{raw_naukri} {raw_linkedin} {raw_indeed} {raw_google}"
            print(f"[SkillGap] Scraped {len(raw_text):,} chars of job text")
            
            scraped_skills_raw = extract_skills_from_text(raw_text)
            
            # C) Merge lists
            # Prioritize scraped skills if they appear frequently
            for sname, count in scraped_skills_raw.items():
                name = sname.lower().strip()
                if name in freq_map:
                    # Boost existing O*NET skill
                    freq_map[name] += count
                else:
                    # New modern skill from market
                    freq_map[name] = count
            
            # D) BLEND in core seed skills (User's "Default Role Skills")
            seed_skills = _role_seed_skills(target_role)
            for ss in seed_skills:
                name = ss.lower().strip()
                if name in freq_map:
                    # Priority boost for core seed skills
                    freq_map[name] += 50
                else:
                    freq_map[name] = 25  # Solid entry for seed skills
            
            # Build level mapping for sorting
            level_map = {}
            for s in onet_list:
                level_map[s["name"].lower().strip()] = s.get("level", "intermediate")
            for ss in seed_skills:
                level_map[ss.lower().strip()] = "beginner"
            
            # Sort order: beginner(0) -> intermediate(1) -> advanced(2)
            LEVEL_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}
            
            # Sort by difficulty first, then by frequency
            sorted_names = sorted(
                freq_map.keys(), 
                key=lambda x: (LEVEL_ORDER.get(level_map.get(x, "intermediate"), 1), -freq_map[x])
            )
            required_skills = [s.title() for s in sorted_names[:top_n]]
            scrape_source = "hybrid-onet-market-seeded"
            
            if not required_skills and not onet_list:
                # Absolute fallback
                print("[SkillGap] All sources failed, using seed catalogue")
                required_skills = seed_catalogue.get(target_role, seed_catalogue.get("Software Engineer", []))
                scrape_source = "seed-catalogue"

            # ── Step 4: Cache the results ────────────────────────────────────
            _cache_set(target_role, {
                "freq_map": freq_map,
                "required_skills": required_skills,
                "source": scrape_source
            })

        # ── Step 5: Semantic matching (sentence-transformer or TF-IDF) ───────
        print(f"[SkillGap] Semantic matching {len(user_skills)} user skills vs {len(required_skills)} required...")
        matched, missing, match_score = semantic_skill_match(
            user_skills, required_skills, threshold=0.55
        )

        # ── Step 6: Prioritize gaps by scraped frequency ─────────────────────
        print(f"[SkillGap] Prioritizing {len(missing)} gaps...")
        priority = _prioritize_gaps(target_role, missing, freq_map)

        result = {
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
            "scraped_text_length":  len(raw_text) if 'raw_text' in dir() else 0,
            "skills_source":        scrape_source if 'scrape_source' in dir() else "cache",
            "ml_pipeline":          "scrape(naukri+linkedin+indeed+google) → nlp(spacy+regex+ngrams) → embed(sentence-transformer) → prioritize(frequency)",
        }

        print(f"[SkillGap] ✓ Done — {len(matched)} matched, {len(missing)} missing, score={match_score:.1f}%\n")
        return result


# ── Singleton ─────────────────────────────────────────────────────────────────
_analyzer: Optional[DynamicSkillGapAnalyzer] = None

def get_analyzer() -> DynamicSkillGapAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = DynamicSkillGapAnalyzer()
    return _analyzer


def analyze_skill_gap(user_skills: List[str], target_role: str, location: str = "India", refresh: bool = False) -> Dict:
    """Public API used by Flask routes."""
    return get_analyzer().analyze(user_skills, target_role, location, refresh=refresh)


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ML skill-gap analyzer (Dynamic NLP)")
    parser.add_argument("--skills",   default="Python,SQL,React")
    parser.add_argument("--role",     default="Data Scientist")
    parser.add_argument("--location", default="India")
    parser.add_argument("--refresh",  action="store_true")
    args = parser.parse_args()

    user_skills = [s.strip() for s in args.skills.split(",") if s.strip()]
    result      = analyze_skill_gap(user_skills, args.role, args.location, refresh=args.refresh)
    print(json.dumps(result, indent=2))