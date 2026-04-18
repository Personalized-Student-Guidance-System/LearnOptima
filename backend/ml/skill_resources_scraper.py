"""
skill_resources_scraper.py  ──  Universal Role Roadmap Generator (v4 — Dynamic)
═══════════════════════════════════════════════════════════════════════════════

WHAT CHANGED FROM v3:
  ✅ O*NET API is now FIRST priority (free, 1000+ roles, data-driven difficulty)
  ✅ _get_scraped_skills now uses Adzuna full job descriptions + Gemini (no broken imports)
  ✅ classify_difficulty uses Gemini for unknown skills (not just keyword matching)
  ✅ Background cache refresh — stale data re-fetches silently after 6h
  ✅ Static catalogue is a true fallback, not the default winner
  ✅ Structured skill deduplication across all sources

ARCHITECTURE:
  ┌─────────────────────────────────────────────────────────────────┐
  │  SKILLS (priority order — first that succeeds wins)             │
  │  1. O*NET API (free, 1000+ roles, importance-scored)            │
  │  2. Adzuna job descriptions + NLP extraction (live, weekly)     │
  │  3. Static catalogue (50+ roles, reliable offline backup)       │
  │  4. Local JSON fallback (30+ extra roles)                       │
  │  5. Generic skeleton (last resort)                              │
  │                                                                  │
  │  JOBS (real, recent, aggregated like Google Jobs)               │
  │  1. SerpAPI Google Jobs    → if SERPAPI_KEY set                 │
  │  2. Adzuna API             → if ADZUNA keys set                 │
  │  3. Indeed RSS feed        → free, no key needed                │
  │  4. Smart curated links    → ultimate fallback                  │
  │                                                                  │
  │  CACHE                                                           │
  │  - MongoDB persistent (24h TTL)                                 │
  │  - In-memory (2h TTL)                                           │
  │  - Background refresh after 6h (serves stale, refreshes async) │
  └─────────────────────────────────────────────────────────────────┘

SETUP (.env):
  ONET_USERNAME=...          (free at onetonline.org/developer — PRIORITY 1)
  ADZUNA_APP_ID=...          (free at developer.adzuna.com — PRIORITY 2 for skills)
  ADZUNA_APP_KEY=...
  GEMINI_API_KEY=...         (free tier at aistudio.google.com — used with Adzuna)
  MONGO_URI=...              (optional — enables persistent caching)
  SERPAPI_KEY=...            (optional — for Google Jobs aggregation)

HOW TO GET FREE KEYS:
  O*NET  → https://services.onetcenter.org/developer/  (instant approval)
  Adzuna → https://developer.adzuna.com/               (free tier)
  Gemini → https://aistudio.google.com/app/apikey      (free tier)
  SerpAPI→ https://serpapi.com/users/sign_up           (100 free/month)
"""

import argparse
import json
import os
import re
import sys
import time
import random
import threading
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import requests
from dotenv import load_dotenv

# ── encoding fix ───────────────────────────────────────────────────────────────
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# ─────────────────────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

ONET_BASE    = "https://api-v2.onetcenter.org/online"
SERPAPI_BASE = "https://serpapi.com/search"
ADZUNA_BASE  = "https://api.adzuna.com/v1/api/jobs"

# Shared utilities
from onet_utils import OnetClient

# How old cached skills must be before a background refresh is triggered (seconds)
SKILL_REFRESH_AFTER_SECS = 6 * 3600   # 6 hours
MEM_TTL_SECS             = 7200       # 2 hours in-memory TTL
CACHE_TTL_HOURS          = 24         # MongoDB document TTL


# ─────────────────────────────────────────────────────────────────────────────
#  Local Caches & Utils
# ─────────────────────────────────────────────────────────────────────────────
_YT_CACHE = {}  # Cache YouTube results for the current session

def _fetch_first_youtube_video(query: str) -> Optional[str]:
    """Scrape the first video link for a query to avoid giving users search result pages."""
    if query in _YT_CACHE:
        return _YT_CACHE[query]
    
    url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=4)
        # Look for "watch?v=" followed by 11 chars
        match = re.search(r'\"/watch\?v=([a-zA-Z0-9_-]{11})\"', r.text)
        if match:
            v_url = f"https://www.youtube.com/watch?v={match.group(1)}"
            _YT_CACHE[query] = v_url
            return v_url
    except Exception:
        pass
    return None

def _get_roadmap_sh_url(skill: str) -> Optional[str]:
    """Check if roadmap.sh has a path for this skill."""
    s = str(skill or "").lower().replace(" ", "-")
    # Common ones we know exist
    known_paths = ["python", "javascript", "typescript", "react", "angular", "vue", "node.js",
                   "devops", "frontend", "backend", "full-stack", "android", "ios", "postgresql",
                   "blockchain", "qa", "ux-design", "cyber-security", "system-design", "ai-data-scientist",
                   "machine-learning", "software-architect"]
    if s in known_paths:
        return f"https://roadmap.sh/{s}"
    return None

# ─────────────────────────────────────────────────────────────────────────────
#  MongoDB persistent cache
# ─────────────────────────────────────────────────────────────────────────────
_memory_cache: Dict[str, Dict] = {}


class RoadmapCache:

    def __init__(self):
        self._collection = None
        self._connected  = False
        self._connect()

    def _connect(self):
        uri = os.environ.get("MONGO_URI", "")
        if not uri:
            print("[Cache] MONGO_URI not set — in-memory only", file=sys.stderr)
            return
        try:
            from pymongo import MongoClient
            client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            coll = client["learnoptima"]["roadmap_cache_v5"]
            coll.create_index("expiresAt", expireAfterSeconds=0, background=True)
            coll.create_index("cacheKey",  unique=True,          background=True)
            self._collection = coll
            self._connected  = True
            print("[Cache] ✓ MongoDB connected", file=sys.stderr)
        except Exception as e:
            print(f"[Cache] MongoDB failed ({e}) — in-memory fallback", file=sys.stderr)

    def get(self, key: str) -> Optional[Dict]:
        if key in _memory_cache:
            e = _memory_cache[key]
            if (time.time() - e["ts"]) < MEM_TTL_SECS:
                print(f"[Cache HIT] in-memory: {key}")
                return e["data"]
        if self._connected:
            try:
                doc = self._collection.find_one({"cacheKey": key})
                if doc:
                    doc.pop("_id", None)
                    doc.pop("expiresAt", None)
                    doc.pop("cacheKey", None)
                    _memory_cache[key] = {"ts": time.time(), "data": doc}
                    print(f"[Cache HIT] MongoDB: {key}")
                    return doc
            except Exception as e:
                print(f"[Cache] read error: {e}")
        print(f"[Cache MISS] {key}")
        return None

    def get_age_secs(self, key: str) -> Optional[float]:
        """Return how many seconds ago this cache entry was generated, or None if not found."""
        if key in _memory_cache:
            return time.time() - _memory_cache[key]["ts"]
        if self._connected:
            try:
                doc = self._collection.find_one({"cacheKey": key}, {"generated_at": 1})
                if doc and doc.get("generated_at"):
                    gen = datetime.fromisoformat(doc["generated_at"].replace("Z", "+00:00"))
                    return (datetime.now(tz=timezone.utc) - gen).total_seconds()
            except Exception:
                pass
        return None

    def set(self, key: str, data: Dict):
        _memory_cache[key] = {"ts": time.time(), "data": data}
        if self._connected:
            try:
                doc = {
                    "cacheKey":  key,
                    "expiresAt": datetime.now(tz=timezone.utc) + timedelta(hours=CACHE_TTL_HOURS),
                    **data,
                }
                self._collection.replace_one({"cacheKey": key}, doc, upsert=True)
                print(f"[Cache] saved: {key} (TTL {CACHE_TTL_HOURS}h)")
            except Exception as e:
                print(f"[Cache] write error: {e}")

    def invalidate(self, key: str):
        _memory_cache.pop(key, None)
        if self._connected:
            try:
                self._collection.delete_one({"cacheKey": key})
                print(f"[Cache] invalidated: {key}")
            except Exception as e:
                print(f"[Cache] invalidate error: {e}")


_cache = RoadmapCache()


# ─────────────────────────────────────────────────────────────────────────────
#  Role normalisation
# ─────────────────────────────────────────────────────────────────────────────
ROLE_ALIASES: Dict[str, str] = {
    "swe":                  "Software Engineer",
    "frontend":             "Frontend Developer",
    "front end":            "Frontend Developer",
    "front-end":            "Frontend Developer",
    "backend":              "Backend Developer",
    "back end":             "Backend Developer",
    "back-end":             "Backend Developer",
    "devops":               "DevOps Engineer",
    "sre":                  "Site Reliability Engineer",
    "ml engineer":          "Machine Learning Engineer",
    "mle":                  "Machine Learning Engineer",
    "ds":                   "Data Scientist",
    "da":                   "Data Analyst",
    "pm":                   "Product Manager",
    "ca":                   "Chartered Accountant",
    "chartered accountant": "Chartered Accountant",
    "doc":                  "Doctor",
    "physician":            "Doctor",
    "fullstack":            "Full Stack Developer",
    "full-stack":           "Full Stack Developer",
    "full stack":           "Full Stack Developer",
    "android":              "Android Developer",
    "ios":                  "iOS Developer",
    "ux":                   "UX Designer",
    "ui":                   "UI Designer",
    "ux designer":          "UX Designer",
    "police":               "Police Officer",
    "policing":             "Police Officer",
}


def normalize_role(role: str) -> str:
    r = (role or "").strip()
    return ROLE_ALIASES.get(r.lower(), r) if r else "Software Engineer"


# ─────────────────────────────────────────────────────────────────────────────
#  Tech role detector
# ─────────────────────────────────────────────────────────────────────────────
_TECH_ROLE_HINTS = {
    "engineer", "developer", "scientist", "analyst", "devops", "sre",
    "frontend", "backend", "full stack", "software", "ml", "data",
    "cloud", "security", "blockchain", "android", "ios", "qa",
}


def _is_tech_role(role: str) -> bool:
    rl = normalize_role(role).lower()
    # Use word boundaries to avoid matching 'police' against nothing, or 'data' in 'foundation'
    # Actually simpler: check for common tech role keywords as whole words
    tech_keywords = {
        "engineer", "developer", "scientist", "analyst", "devops", "sre",
        "frontend", "backend", "fullstack", "software", "ml", "data",
        "cloud", "security", "blockchain", "android", "ios", "qa", "ux", "ui"
    }
    role_words = set(re.findall(r'\w+', rl))
    return any(kw in role_words for kw in tech_keywords)


# ─────────────────────────────────────────────────────────────────────────────
#  Difficulty classifier — keyword fallback + Gemini for unknown skills
# ─────────────────────────────────────────────────────────────────────────────
_BEGINNER_KW = {
    "python", "javascript", "java", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin",
    "sql", "html", "css", "git", "linux", "bash", "excel", "mathematics", "linear algebra",
    "calculus", "statistics", "probability", "data structures", "algorithms", "networking",
    "quantum mechanics", "cryptography basics", "blockchain concepts",
    "clinical diagnosis", "patient assessment", "medical ethics",
    "financial accounting", "direct tax", "indirect tax", "gst", "product thinking",
    "market research", "user research", "anatomy", "physiology", "basic chemistry",
    "accounting basics", "bookkeeping", "ms office", "communication", "time management",
    "active listening", "customer service", "food safety", "culinary basics", "baking",
    "carpentry basics", "electrical basics", "plumbing basics", "first aid",
    "physical fitness", "self defense", "report writing", "patrol procedures", "laws of arrest",
}

_ADVANCED_KW = {
    "deep learning", "tensorflow", "pytorch", "kubernetes", "aws", "gcp", "azure",
    "system design", "microservices", "ci/cd", "model deployment", "mlops",
    "quantum error correction", "threat modeling", "cloud security", "incident response",
    "emergency care", "hospital protocols", "risk compliance", "stakeholder management",
    "go-to-market strategy", "performance optimization", "security hardening",
    "monitoring & logging", "security auditing", "merger & acquisition", "valuation",
    "surgical techniques", "differential diagnosis", "case management",
    "machine learning", "neural networks", "blockchain architecture", "zero knowledge proof",
    "distributed systems", "consensus algorithms", "advanced taxation", "forensic audit",
    "crisis intervention", "hostage negotiation", "cybercrime investigation", "forensic science",
    "tactical operations", "public safety management", "criminal investigation",
}

# Cache Gemini difficulty lookups to avoid repeated API calls for the same skill
_difficulty_cache: Dict[str, str] = {}


def classify_difficulty(skill: str, role: str = "") -> str:
    """
    3-tier difficulty classification:
    1. Fast keyword match (no API call)
    2. Gemini API call for unknown skills (cached per skill+role)
    3. Default to 'intermediate' if everything fails
    """
    s = skill.lower().strip()

    # Tier 1: fast keyword match
    if any(kw in s for kw in _ADVANCED_KW):
        return "advanced"
    if any(kw in s for kw in _BEGINNER_KW):
        return "beginner"

    # Tier 2: Gemini for unknown skills
    cache_key = f"{s}::{role.lower()}"
    if cache_key in _difficulty_cache:
        return _difficulty_cache[cache_key]

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if api_key:
        level = _classify_with_gemini(skill, role, api_key)
        _difficulty_cache[cache_key] = level
        return level

    return "intermediate"


def _classify_with_gemini(skill: str, role: str, api_key: str) -> str:
    """Ask Gemini whether a skill is beginner/intermediate/advanced for a given role."""
    prompt = (
        f"For someone becoming a '{role}', is the skill '{skill}' "
        f"beginner, intermediate, or advanced level? "
        f"Reply with ONLY one word: beginner, intermediate, or advanced."
    )
    models = ["gemini-1.5-flash"]
    try:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
            params={"key": api_key},
            headers={"Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"temperature": 0.0, "maxOutputTokens": 10}},
            timeout=10,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip().lower()
        if "beginner" in text:
            return "beginner"
        if "advanced" in text:
            return "advanced"
        return "intermediate"
    except Exception as e:
        print(f"[Gemini Difficulty] failed: {e}")
    return "intermediate"


# ─────────────────────────────────────────────────────────────────────────────
#  O*NET API  (Priority 1 — free, covers 1000+ occupations)
#  Register: https://services.onetcenter.org/developer/
# ─────────────────────────────────────────────────────────────────────────────
_onet = OnetClient()


# ─────────────────────────────────────────────────────────────────────────────
#  Adzuna + Gemini skill extractor  (Priority 2 — live job descriptions)
# ─────────────────────────────────────────────────────────────────────────────
def _fetch_adzuna_job_descriptions(role: str, location: str, num: int = 8) -> str:
    """
    Fetch full job descriptions from Adzuna for a role.
    Returns concatenated text suitable for Gemini skill extraction.
    """
    app_id  = os.environ.get("ADZUNA_APP_ID", "")
    app_key = os.environ.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        print("[Adzuna Descriptions] No keys set — skipping")
        return ""

    country_map = {
        "india": "in", "united states": "us", "usa": "us", "uk": "gb",
        "united kingdom": "gb", "australia": "au", "canada": "ca",
        "germany": "de", "france": "fr", "singapore": "sg",
    }
    country = country_map.get(location.lower().strip(), "in")

    try:
        url    = f"{ADZUNA_BASE}/{country}/search/1"
        params = {
            "app_id":           app_id,
            "app_key":          app_key,
            "what":             role,
            "where":            location,
            "results_per_page": min(num, 20),
            "full_description": 1,       # ← key flag: get full JD text
            "content-type":     "application/json",
        }
        r = requests.get(url, params=params, timeout=15)
        if r.status_code != 200:
            print(f"[Adzuna Descriptions] HTTP {r.status_code}")
            return ""

        results = r.json().get("results", [])
        if not results:
            print(f"[Adzuna Descriptions] No results for '{role}'")
            return ""

        # Combine title + description for all jobs
        parts = []
        for j in results[:num]:
            title = j.get("title", "")
            desc  = j.get("description", "")
            parts.append(f"JOB TITLE: {title}\nDESCRIPTION: {desc}")

        text = "\n\n---\n\n".join(parts)
        print(f"[Adzuna Descriptions] Got {len(results)} JDs for '{role}' ({len(text)} chars)")
        return text

    except Exception as e:
        print(f"[Adzuna Descriptions] Error: {e}")
        return ""


def _extract_skills_with_gemini(job_text: str, role: str, max_items: int = 14) -> List[str]:
    """
    Use Gemini to extract current industry skills from live job description text.
    Passes a small prompt (first 2500 chars) to avoid quota usage.
    Falls back to local NLP if the call fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    # Pre-compute NLP fallback
    try:
        from skill_extractor import extract_skills_from_text
        freq_map = extract_skills_from_text(job_text, top_n=max_items)
        fallback_skills = list(freq_map.keys())
    except ImportError:
        fallback_skills = []

    if not api_key or not job_text.strip():
        return fallback_skills

    prompt = (
        f"You are a career advisor. Extract the most important CURRENT industry skills, "
        f"tools, certifications, and knowledge areas required for the role '{role}' "
        f"from the following real job postings.\n\n"
        f"Rules:\n"
        f"- Return ONLY a JSON array of concise skill/tool name strings\n"
        f"- Maximum {max_items} items\n"
        f"- Order by frequency/importance across all job postings\n"
        f"- Be specific (e.g. 'React' not 'frontend frameworks', 'GST' not 'taxation')\n"
        f"- No generic filler like 'hard work', 'team player'\n"
        f"- No preamble, no markdown fences, just the JSON array\n\n"
        f"JOB POSTINGS:\n{job_text[:2500]}"
    )

    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
            params={"key": api_key},
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "response_mime_type": "application/json",
                },
            },
            timeout=25,
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["candidates"][0]["content"]["parts"][0]["text"].strip()
        text = re.sub(r"^```json\s*", "", text, flags=re.I)
        text = re.sub(r"```$", "", text).strip()
        parsed = json.loads(text)
        
        if isinstance(parsed, list):
            skills = [str(s).strip() for s in parsed if str(s).strip()][:max_items]
            if skills:
                print(f"[Gemini Skills] Extracted {len(skills)} skills for '{role}' successfully.")
                return skills
    except Exception as e:
        print(f"[Gemini Skills] Failed, using local NLP fallback instead: {e}")

    return fallback_skills

def _get_scraped_skills(role: str, location: str = "India", num_jobs: int = 8) -> List[Dict]:
    """
    Live skill extraction pipeline:
    1. Fetch real job descriptions from Adzuna (with full_description=1)
    2. Pass combined text to local NLP for skill extraction (formerly Gemini)
    3. Classify each skill's difficulty
    """
    role = normalize_role(role)

    # Step 1: Get live job description text
    job_text = _fetch_adzuna_job_descriptions(role, location, num_jobs)
    if not job_text.strip():
        print(f"[Scraped Skills] No job text available for '{role}' — skipping")
        return []

    # Step 2: Extract skills (try Gemini first with small prompt, then NLP fallback)
    skill_names = _extract_skills_with_gemini(job_text, role, max_items=14)
    
    if not skill_names:
        print(f"[Scraped Skills] Both Gemini and NLP returned no skills for '{role}'")
        return []

    # Step 3: Classify difficulty for each skill
    skills = []
    for name in skill_names:
        level  = classify_difficulty(name, role)
        skills.append({"name": name, "level": level})

    print(f"[Scraped Skills] '{role}' → {len(skills)} live skills from Adzuna+NLP")
    return skills


# ─────────────────────────────────────────────────────────────────────────────
#  Static skill catalogue — 50+ roles (Priority 3 — reliable offline backup)
# ─────────────────────────────────────────────────────────────────────────────
ROLE_CATALOGUE: Dict[str, List[Dict]] = {

    # ── Tech ──────────────────────────────────────────────────────────────────
    "Software Engineer": [
        {"name": "Python",            "level": "beginner"},
        {"name": "JavaScript",        "level": "beginner"},
        {"name": "Data Structures",   "level": "beginner"},
        {"name": "Algorithms",        "level": "beginner"},
        {"name": "Git",               "level": "beginner"},
        {"name": "SQL",               "level": "beginner"},
        {"name": "React",             "level": "intermediate"},
        {"name": "Node.js",           "level": "intermediate"},
        {"name": "REST APIs",         "level": "intermediate"},
        {"name": "Docker",            "level": "intermediate"},
        {"name": "System Design",     "level": "advanced"},
        {"name": "Kubernetes",        "level": "advanced"},
        {"name": "AWS",               "level": "advanced"},
        {"name": "CI/CD",             "level": "advanced"},
    ],
    "Frontend Developer": [
        {"name": "HTML",                       "level": "beginner"},
        {"name": "CSS",                        "level": "beginner"},
        {"name": "JavaScript",                 "level": "beginner"},
        {"name": "Git",                        "level": "beginner"},
        {"name": "React",                      "level": "intermediate"},
        {"name": "TypeScript",                 "level": "intermediate"},
        {"name": "Tailwind CSS",               "level": "intermediate"},
        {"name": "REST APIs",                  "level": "intermediate"},
        {"name": "Testing",                    "level": "advanced"},
        {"name": "Performance Optimization",   "level": "advanced"},
        {"name": "Accessibility",              "level": "advanced"},
        {"name": "Build Tools (Vite/Webpack)", "level": "advanced"},
    ],
    "Backend Developer": [
        {"name": "Python",         "level": "beginner"},
        {"name": "SQL",            "level": "beginner"},
        {"name": "Data Structures","level": "beginner"},
        {"name": "Git",            "level": "beginner"},
        {"name": "Node.js",        "level": "intermediate"},
        {"name": "REST APIs",      "level": "intermediate"},
        {"name": "PostgreSQL",     "level": "intermediate"},
        {"name": "MongoDB",        "level": "intermediate"},
        {"name": "Docker",         "level": "intermediate"},
        {"name": "System Design",  "level": "advanced"},
        {"name": "AWS",            "level": "advanced"},
        {"name": "Microservices",  "level": "advanced"},
        {"name": "Security",       "level": "advanced"},
    ],
    "Full Stack Developer": [
        {"name": "HTML",          "level": "beginner"},
        {"name": "CSS",           "level": "beginner"},
        {"name": "JavaScript",    "level": "beginner"},
        {"name": "Python",        "level": "beginner"},
        {"name": "SQL",           "level": "beginner"},
        {"name": "React",         "level": "intermediate"},
        {"name": "Node.js",       "level": "intermediate"},
        {"name": "REST APIs",     "level": "intermediate"},
        {"name": "MongoDB",       "level": "intermediate"},
        {"name": "Docker",        "level": "intermediate"},
        {"name": "System Design", "level": "advanced"},
        {"name": "AWS",           "level": "advanced"},
        {"name": "CI/CD",         "level": "advanced"},
    ],
    "DevOps Engineer": [
        {"name": "Linux",                "level": "beginner"},
        {"name": "Bash Scripting",       "level": "beginner"},
        {"name": "Git",                  "level": "beginner"},
        {"name": "Networking Basics",    "level": "beginner"},
        {"name": "Docker",               "level": "intermediate"},
        {"name": "CI/CD",                "level": "intermediate"},
        {"name": "Terraform",            "level": "intermediate"},
        {"name": "Ansible",              "level": "intermediate"},
        {"name": "Kubernetes",           "level": "advanced"},
        {"name": "AWS",                  "level": "advanced"},
        {"name": "Monitoring & Logging", "level": "advanced"},
        {"name": "Security Hardening",   "level": "advanced"},
    ],
    "Site Reliability Engineer": [
        {"name": "Linux",             "level": "beginner"},
        {"name": "Python",            "level": "beginner"},
        {"name": "Networking",        "level": "beginner"},
        {"name": "Git",               "level": "beginner"},
        {"name": "Docker",            "level": "intermediate"},
        {"name": "Kubernetes",        "level": "intermediate"},
        {"name": "Prometheus",        "level": "intermediate"},
        {"name": "Grafana",           "level": "intermediate"},
        {"name": "Incident Response", "level": "advanced"},
        {"name": "Chaos Engineering", "level": "advanced"},
        {"name": "AWS",               "level": "advanced"},
        {"name": "SLOs & SLAs",       "level": "advanced"},
    ],
    "Data Scientist": [
        {"name": "Python",             "level": "beginner"},
        {"name": "SQL",                "level": "beginner"},
        {"name": "Statistics",         "level": "beginner"},
        {"name": "Probability",        "level": "beginner"},
        {"name": "Pandas",             "level": "intermediate"},
        {"name": "NumPy",              "level": "intermediate"},
        {"name": "Scikit-learn",       "level": "intermediate"},
        {"name": "Data Visualization", "level": "intermediate"},
        {"name": "Machine Learning",   "level": "intermediate"},
        {"name": "Feature Engineering","level": "intermediate"},
        {"name": "Deep Learning",      "level": "advanced"},
        {"name": "TensorFlow",         "level": "advanced"},
        {"name": "PyTorch",            "level": "advanced"},
        {"name": "A/B Testing",        "level": "advanced"},
    ],
    "Data Analyst": [
        {"name": "Excel",              "level": "beginner"},
        {"name": "SQL",                "level": "beginner"},
        {"name": "Statistics",         "level": "beginner"},
        {"name": "Python",             "level": "intermediate"},
        {"name": "Pandas",             "level": "intermediate"},
        {"name": "Data Visualization", "level": "intermediate"},
        {"name": "Power BI",           "level": "intermediate"},
        {"name": "Tableau",            "level": "intermediate"},
        {"name": "Business Analysis",  "level": "advanced"},
        {"name": "Dashboarding",       "level": "advanced"},
        {"name": "A/B Testing",        "level": "advanced"},
    ],
    "Machine Learning Engineer": [
        {"name": "Python",              "level": "beginner"},
        {"name": "Statistics",          "level": "beginner"},
        {"name": "Linear Algebra",      "level": "beginner"},
        {"name": "SQL",                 "level": "beginner"},
        {"name": "Pandas",              "level": "intermediate"},
        {"name": "NumPy",               "level": "intermediate"},
        {"name": "Scikit-learn",        "level": "intermediate"},
        {"name": "TensorFlow",          "level": "intermediate"},
        {"name": "PyTorch",             "level": "intermediate"},
        {"name": "MLOps",               "level": "advanced"},
        {"name": "Feature Engineering", "level": "advanced"},
        {"name": "Model Deployment",    "level": "advanced"},
        {"name": "Docker",              "level": "advanced"},
    ],
    "Android Developer": [
        {"name": "Java",               "level": "beginner"},
        {"name": "Kotlin",             "level": "beginner"},
        {"name": "Git",                "level": "beginner"},
        {"name": "XML Layouts",        "level": "beginner"},
        {"name": "Android SDK",        "level": "intermediate"},
        {"name": "Jetpack Compose",    "level": "intermediate"},
        {"name": "REST APIs",          "level": "intermediate"},
        {"name": "Room Database",      "level": "intermediate"},
        {"name": "Firebase",           "level": "intermediate"},
        {"name": "Play Store Publish", "level": "advanced"},
        {"name": "Performance",        "level": "advanced"},
        {"name": "Testing",            "level": "advanced"},
    ],
    "iOS Developer": [
        {"name": "Swift",              "level": "beginner"},
        {"name": "Objective-C",        "level": "beginner"},
        {"name": "Xcode",              "level": "beginner"},
        {"name": "Git",                "level": "beginner"},
        {"name": "UIKit",              "level": "intermediate"},
        {"name": "SwiftUI",            "level": "intermediate"},
        {"name": "REST APIs",          "level": "intermediate"},
        {"name": "CoreData",           "level": "intermediate"},
        {"name": "App Store Publish",  "level": "advanced"},
        {"name": "Performance",        "level": "advanced"},
        {"name": "Testing (XCTest)",   "level": "advanced"},
    ],
    "Security Engineer": [
        {"name": "Networking",          "level": "beginner"},
        {"name": "Linux",               "level": "beginner"},
        {"name": "Python",              "level": "beginner"},
        {"name": "Cryptography",        "level": "intermediate"},
        {"name": "Penetration Testing", "level": "intermediate"},
        {"name": "OWASP",               "level": "intermediate"},
        {"name": "SIEM Tools",          "level": "intermediate"},
        {"name": "Incident Response",   "level": "advanced"},
        {"name": "Threat Modeling",     "level": "advanced"},
        {"name": "Cloud Security",      "level": "advanced"},
    ],
    "Blockchain Developer": [
        {"name": "JavaScript",          "level": "beginner"},
        {"name": "Cryptography Basics", "level": "beginner"},
        {"name": "Blockchain Concepts", "level": "beginner"},
        {"name": "Solidity",            "level": "intermediate"},
        {"name": "Ethereum",            "level": "intermediate"},
        {"name": "Smart Contracts",     "level": "intermediate"},
        {"name": "Web3.js / Ethers.js", "level": "intermediate"},
        {"name": "DeFi Protocols",      "level": "advanced"},
        {"name": "NFT Standards",       "level": "advanced"},
        {"name": "Layer 2 Solutions",   "level": "advanced"},
        {"name": "Security Auditing",   "level": "advanced"},
    ],
    "Product Manager": [
        {"name": "Product Thinking",       "level": "beginner"},
        {"name": "Market Research",        "level": "beginner"},
        {"name": "User Research",          "level": "beginner"},
        {"name": "SQL",                    "level": "intermediate"},
        {"name": "Data Analysis",          "level": "intermediate"},
        {"name": "Product Roadmapping",    "level": "intermediate"},
        {"name": "Agile / Scrum",          "level": "intermediate"},
        {"name": "Stakeholder Management", "level": "advanced"},
        {"name": "OKRs & Metrics",         "level": "advanced"},
        {"name": "Go-to-Market Strategy",  "level": "advanced"},
    ],
    "UX Designer": [
        {"name": "Design Thinking",         "level": "beginner"},
        {"name": "User Research",           "level": "beginner"},
        {"name": "Wireframing",             "level": "beginner"},
        {"name": "Figma",                   "level": "intermediate"},
        {"name": "Prototyping",             "level": "intermediate"},
        {"name": "Usability Testing",       "level": "intermediate"},
        {"name": "Information Architecture","level": "intermediate"},
        {"name": "Accessibility",           "level": "advanced"},
        {"name": "Design Systems",          "level": "advanced"},
        {"name": "Motion Design",           "level": "advanced"},
    ],

    # ── Finance / Accounting ──────────────────────────────────────────────────
    "Chartered Accountant": [
        {"name": "Financial Accounting",  "level": "beginner"},
        {"name": "Direct Tax",            "level": "beginner"},
        {"name": "Indirect Tax (GST)",    "level": "beginner"},
        {"name": "Excel",                 "level": "beginner"},
        {"name": "Auditing Standards",    "level": "intermediate"},
        {"name": "Financial Reporting",   "level": "intermediate"},
        {"name": "Cost Accounting",       "level": "intermediate"},
        {"name": "Corporate Law",         "level": "intermediate"},
        {"name": "Tally / ERP",           "level": "intermediate"},
        {"name": "Risk & Compliance",     "level": "advanced"},
        {"name": "Merger & Acquisition",  "level": "advanced"},
        {"name": "Forensic Audit",        "level": "advanced"},
    ],
    "Financial Analyst": [
        {"name": "Accounting Basics",    "level": "beginner"},
        {"name": "Excel",                "level": "beginner"},
        {"name": "Financial Statements", "level": "beginner"},
        {"name": "SQL",                  "level": "intermediate"},
        {"name": "Financial Modeling",   "level": "intermediate"},
        {"name": "Valuation",            "level": "intermediate"},
        {"name": "Bloomberg Terminal",   "level": "intermediate"},
        {"name": "Python",               "level": "intermediate"},
        {"name": "Risk Analysis",        "level": "advanced"},
        {"name": "DCF Modeling",         "level": "advanced"},
        {"name": "Derivatives",          "level": "advanced"},
    ],

    # ── Medical / Healthcare ─────────────────────────────────────────────────
    "Doctor": [
        {"name": "Anatomy",                   "level": "beginner"},
        {"name": "Physiology",                "level": "beginner"},
        {"name": "Clinical Diagnosis",        "level": "beginner"},
        {"name": "Patient Assessment",        "level": "beginner"},
        {"name": "Medical Ethics",            "level": "beginner"},
        {"name": "Pharmacology",              "level": "intermediate"},
        {"name": "Evidence-Based Medicine",   "level": "intermediate"},
        {"name": "Electronic Health Records", "level": "intermediate"},
        {"name": "Differential Diagnosis",    "level": "intermediate"},
        {"name": "Emergency Care",            "level": "advanced"},
        {"name": "Surgical Techniques",       "level": "advanced"},
        {"name": "Case Management",           "level": "advanced"},
    ],
    "Nurse": [
        {"name": "Anatomy & Physiology",      "level": "beginner"},
        {"name": "Patient Care",              "level": "beginner"},
        {"name": "Medical Ethics",            "level": "beginner"},
        {"name": "First Aid",                 "level": "beginner"},
        {"name": "Pharmacology",              "level": "intermediate"},
        {"name": "IV Therapy",                "level": "intermediate"},
        {"name": "Electronic Health Records", "level": "intermediate"},
        {"name": "Wound Care",                "level": "intermediate"},
        {"name": "Critical Care Nursing",     "level": "advanced"},
        {"name": "Emergency Care",            "level": "advanced"},
    ],

    # ── Law ───────────────────────────────────────────────────────────────────
    "Lawyer": [
        {"name": "Constitutional Law",  "level": "beginner"},
        {"name": "Criminal Law",        "level": "beginner"},
        {"name": "Legal Research",      "level": "beginner"},
        {"name": "Legal Writing",       "level": "beginner"},
        {"name": "Civil Procedure",     "level": "intermediate"},
        {"name": "Contract Law",        "level": "intermediate"},
        {"name": "Corporate Law",       "level": "intermediate"},
        {"name": "Evidence",            "level": "intermediate"},
        {"name": "Litigation",          "level": "advanced"},
        {"name": "Negotiation",         "level": "advanced"},
        {"name": "Arbitration",         "level": "advanced"},
    ],

    # ── Engineering ───────────────────────────────────────────────────────────
    "Mechanical Engineer": [
        {"name": "Engineering Mathematics", "level": "beginner"},
        {"name": "Engineering Drawing",     "level": "beginner"},
        {"name": "Thermodynamics",          "level": "beginner"},
        {"name": "Fluid Mechanics",         "level": "intermediate"},
        {"name": "Solid Mechanics",         "level": "intermediate"},
        {"name": "AutoCAD / SolidWorks",    "level": "intermediate"},
        {"name": "Manufacturing Processes", "level": "intermediate"},
        {"name": "FEA / Simulation",        "level": "advanced"},
        {"name": "Product Design",          "level": "advanced"},
        {"name": "Project Management",      "level": "advanced"},
    ],
    "Civil Engineer": [
        {"name": "Engineering Mathematics",   "level": "beginner"},
        {"name": "Engineering Drawing",       "level": "beginner"},
        {"name": "Soil Mechanics",            "level": "intermediate"},
        {"name": "Structural Analysis",       "level": "intermediate"},
        {"name": "AutoCAD",                   "level": "intermediate"},
        {"name": "Construction Materials",    "level": "intermediate"},
        {"name": "Surveying",                 "level": "intermediate"},
        {"name": "Project Management",        "level": "advanced"},
        {"name": "Structural Design",         "level": "advanced"},
        {"name": "Environmental Engineering", "level": "advanced"},
    ],

    # ── Creative ──────────────────────────────────────────────────────────────
    "Graphic Designer": [
        {"name": "Design Principles",   "level": "beginner"},
        {"name": "Typography",          "level": "beginner"},
        {"name": "Color Theory",        "level": "beginner"},
        {"name": "Adobe Photoshop",     "level": "intermediate"},
        {"name": "Adobe Illustrator",   "level": "intermediate"},
        {"name": "Figma",               "level": "intermediate"},
        {"name": "Brand Identity",      "level": "intermediate"},
        {"name": "Motion Graphics",     "level": "advanced"},
        {"name": "Print Production",    "level": "advanced"},
        {"name": "Portfolio Building",  "level": "advanced"},
    ],
    "Content Writer": [
        {"name": "Grammar & Style",       "level": "beginner"},
        {"name": "Research Skills",       "level": "beginner"},
        {"name": "SEO Basics",            "level": "beginner"},
        {"name": "Blog Writing",          "level": "intermediate"},
        {"name": "Copywriting",           "level": "intermediate"},
        {"name": "Content Strategy",      "level": "intermediate"},
        {"name": "Social Media Writing",  "level": "intermediate"},
        {"name": "Long-form Content",     "level": "advanced"},
        {"name": "Technical Writing",     "level": "advanced"},
        {"name": "Analytics & Metrics",   "level": "advanced"},
    ],
    "Chef": [
        {"name": "Culinary Basics",        "level": "beginner"},
        {"name": "Food Safety & Hygiene",  "level": "beginner"},
        {"name": "Knife Skills",           "level": "beginner"},
        {"name": "Cooking Techniques",     "level": "intermediate"},
        {"name": "Baking",                 "level": "intermediate"},
        {"name": "Menu Planning",          "level": "intermediate"},
        {"name": "Kitchen Management",     "level": "intermediate"},
        {"name": "Plating & Presentation", "level": "advanced"},
        {"name": "Cuisine Specialisation", "level": "advanced"},
        {"name": "Cost Control",           "level": "advanced"},
    ],
    "Teacher": [
        {"name": "Subject Knowledge",          "level": "beginner"},
        {"name": "Communication",              "level": "beginner"},
        {"name": "Classroom Management",       "level": "beginner"},
        {"name": "Lesson Planning",            "level": "intermediate"},
        {"name": "Assessment Design",          "level": "intermediate"},
        {"name": "Differentiated Instruction", "level": "intermediate"},
        {"name": "EdTech Tools",               "level": "intermediate"},
        {"name": "Special Needs Education",    "level": "advanced"},
        {"name": "Curriculum Development",     "level": "advanced"},
        {"name": "Student Counselling",        "level": "advanced"},
    ],
    "HR Manager": [
        {"name": "Communication",              "level": "beginner"},
        {"name": "Labour Law Basics",          "level": "beginner"},
        {"name": "MS Office",                  "level": "beginner"},
        {"name": "Recruitment & Selection",    "level": "intermediate"},
        {"name": "Onboarding",                 "level": "intermediate"},
        {"name": "Performance Management",     "level": "intermediate"},
        {"name": "Payroll Management",         "level": "intermediate"},
        {"name": "Employee Relations",         "level": "advanced"},
        {"name": "HR Analytics",               "level": "advanced"},
        {"name": "Organisational Development", "level": "advanced"},
    ],
    "Marketing Manager": [
        {"name": "Marketing Fundamentals", "level": "beginner"},
        {"name": "Communication",          "level": "beginner"},
        {"name": "Social Media",           "level": "beginner"},
        {"name": "SEO / SEM",              "level": "intermediate"},
        {"name": "Content Marketing",      "level": "intermediate"},
        {"name": "Email Marketing",        "level": "intermediate"},
        {"name": "Google Analytics",       "level": "intermediate"},
        {"name": "Brand Strategy",         "level": "advanced"},
        {"name": "Paid Advertising",       "level": "advanced"},
        {"name": "Go-to-Market Strategy",  "level": "advanced"},
    ],
}


def _get_catalogue_skills(role: str) -> List[Dict]:
    """Lookup static catalogue with exact → case-insensitive → partial matching."""
    if role in ROLE_CATALOGUE:
        skills = ROLE_CATALOGUE[role]
        print(f"[Catalogue] '{role}' → {len(skills)} skills (exact match)")
        return skills
    rl = role.lower()
    for key, skills in ROLE_CATALOGUE.items():
        if key.lower() == rl:
            print(f"[Catalogue] '{role}' → {len(skills)} skills (case-insensitive)")
            return skills
    for key, skills in ROLE_CATALOGUE.items():
        if rl in key.lower() or key.lower() in rl:
            print(f"[Catalogue] '{role}' → {len(skills)} skills (partial: '{key}')")
            return skills
    print(f"[Catalogue] '{role}' → no match")
    return []


# ─────────────────────────────────────────────────────────────────────────────
#  Local JSON fallback  (Priority 4 — covers 30+ roles not in catalogue)
# ─────────────────────────────────────────────────────────────────────────────
LOCAL_FALLBACK: Dict[str, List[Dict]] = {
    "architect": [
        {"name": "Architectural Drawing",  "level": "beginner"},
        {"name": "AutoCAD",                "level": "beginner"},
        {"name": "Building Codes",         "level": "beginner"},
        {"name": "Revit / BIM",            "level": "intermediate"},
        {"name": "3D Modeling (SketchUp)", "level": "intermediate"},
        {"name": "Structural Systems",     "level": "intermediate"},
        {"name": "Sustainable Design",     "level": "intermediate"},
        {"name": "Project Management",     "level": "advanced"},
        {"name": "Urban Planning",         "level": "advanced"},
        {"name": "Client Presentations",   "level": "advanced"},
    ],
    "pilot": [
        {"name": "Aviation Meteorology",      "level": "beginner"},
        {"name": "Air Navigation",            "level": "beginner"},
        {"name": "Aircraft Systems",          "level": "beginner"},
        {"name": "Flight Operations",         "level": "intermediate"},
        {"name": "Instrument Flying (IFR)",   "level": "intermediate"},
        {"name": "Air Traffic Communication", "level": "intermediate"},
        {"name": "Crew Resource Management",  "level": "advanced"},
        {"name": "Emergency Procedures",      "level": "advanced"},
        {"name": "Multi-Engine Rating",       "level": "advanced"},
    ],
    "psychologist": [
        {"name": "Psychological Foundations", "level": "beginner"},
        {"name": "Research Methods",          "level": "beginner"},
        {"name": "Developmental Psychology",  "level": "beginner"},
        {"name": "Cognitive Psychology",      "level": "intermediate"},
        {"name": "Assessment & Testing",      "level": "intermediate"},
        {"name": "Counselling Skills",        "level": "intermediate"},
        {"name": "Abnormal Psychology",       "level": "intermediate"},
        {"name": "Psychotherapy",             "level": "advanced"},
        {"name": "Neuropsychology",           "level": "advanced"},
        {"name": "Clinical Supervision",      "level": "advanced"},
    ],
    "accountant": [
        {"name": "Bookkeeping",           "level": "beginner"},
        {"name": "Financial Accounting",  "level": "beginner"},
        {"name": "Excel",                 "level": "beginner"},
        {"name": "Taxation",              "level": "intermediate"},
        {"name": "Auditing",              "level": "intermediate"},
        {"name": "Cost Accounting",       "level": "intermediate"},
        {"name": "Tally / QuickBooks",    "level": "intermediate"},
        {"name": "Financial Reporting",   "level": "advanced"},
        {"name": "Risk Assessment",       "level": "advanced"},
    ],
    "social worker": [
        {"name": "Communication",         "level": "beginner"},
        {"name": "Active Listening",      "level": "beginner"},
        {"name": "Human Development",     "level": "beginner"},
        {"name": "Case Management",       "level": "intermediate"},
        {"name": "Crisis Intervention",   "level": "intermediate"},
        {"name": "Community Outreach",    "level": "intermediate"},
        {"name": "Child Welfare",         "level": "advanced"},
        {"name": "Policy & Advocacy",     "level": "advanced"},
        {"name": "Mental Health First Aid","level": "advanced"},
    ],
    "journalist": [
        {"name": "Writing & Grammar",        "level": "beginner"},
        {"name": "Research Skills",          "level": "beginner"},
        {"name": "Interviewing",             "level": "beginner"},
        {"name": "News Writing",             "level": "intermediate"},
        {"name": "Digital Journalism",       "level": "intermediate"},
        {"name": "Multimedia Storytelling",  "level": "intermediate"},
        {"name": "Data Journalism",          "level": "advanced"},
        {"name": "Investigative Reporting",  "level": "advanced"},
        {"name": "Media Ethics & Law",       "level": "advanced"},
    ],
    "electrician": [
        {"name": "Electrical Basics",      "level": "beginner"},
        {"name": "Safety Regulations",     "level": "beginner"},
        {"name": "Reading Blueprints",     "level": "beginner"},
        {"name": "Wiring Techniques",      "level": "intermediate"},
        {"name": "Panel Installation",     "level": "intermediate"},
        {"name": "National Electric Code", "level": "intermediate"},
        {"name": "Motor Controls",         "level": "advanced"},
        {"name": "PLC Programming",        "level": "advanced"},
        {"name": "Solar Installation",     "level": "advanced"},
    ],
    "musician": [
        {"name": "Music Theory",            "level": "beginner"},
        {"name": "Instrument Basics",       "level": "beginner"},
        {"name": "Ear Training",            "level": "beginner"},
        {"name": "Sight Reading",           "level": "intermediate"},
        {"name": "Music Production (DAW)",  "level": "intermediate"},
        {"name": "Harmony & Counterpoint",  "level": "intermediate"},
        {"name": "Live Performance",        "level": "intermediate"},
        {"name": "Recording & Mixing",      "level": "advanced"},
        {"name": "Music Business",          "level": "advanced"},
        {"name": "Composition",             "level": "advanced"},
    ],
    "photographer": [
        {"name": "Camera Basics",              "level": "beginner"},
        {"name": "Composition",               "level": "beginner"},
        {"name": "Lighting Basics",           "level": "beginner"},
        {"name": "Adobe Lightroom",           "level": "intermediate"},
        {"name": "Adobe Photoshop",           "level": "intermediate"},
        {"name": "Portrait Photography",      "level": "intermediate"},
        {"name": "Studio Lighting",           "level": "advanced"},
        {"name": "Commercial Photography",    "level": "advanced"},
        {"name": "Photo Business & Pricing",  "level": "advanced"},
    ],
    "sales": [
        {"name": "Communication",           "level": "beginner"},
        {"name": "Product Knowledge",       "level": "beginner"},
        {"name": "Customer Service",        "level": "beginner"},
        {"name": "Lead Generation",         "level": "intermediate"},
        {"name": "CRM Tools (Salesforce)",  "level": "intermediate"},
        {"name": "Negotiation",             "level": "intermediate"},
        {"name": "Objection Handling",      "level": "intermediate"},
        {"name": "Enterprise Sales",        "level": "advanced"},
        {"name": "Revenue Forecasting",     "level": "advanced"},
        {"name": "Sales Strategy",          "level": "advanced"},
    ],
    "supply chain": [
        {"name": "Logistics Basics",          "level": "beginner"},
        {"name": "Excel",                     "level": "beginner"},
        {"name": "Procurement",              "level": "intermediate"},
        {"name": "Inventory Management",     "level": "intermediate"},
        {"name": "ERP Systems (SAP)",        "level": "intermediate"},
        {"name": "Demand Forecasting",       "level": "intermediate"},
        {"name": "Warehouse Management",     "level": "intermediate"},
        {"name": "Global Trade Compliance",  "level": "advanced"},
        {"name": "Supply Chain Analytics",   "level": "advanced"},
    ],
    "veterinarian": [
        {"name": "Animal Anatomy",       "level": "beginner"},
        {"name": "Animal Behaviour",     "level": "beginner"},
        {"name": "Veterinary Ethics",    "level": "beginner"},
        {"name": "Clinical Examination", "level": "intermediate"},
        {"name": "Pharmacology",         "level": "intermediate"},
        {"name": "Diagnostic Imaging",   "level": "intermediate"},
        {"name": "Surgery",              "level": "advanced"},
        {"name": "Emergency Care",       "level": "advanced"},
        {"name": "Specialist Medicine",  "level": "advanced"},
    ],
}


def _get_local_fallback_skills(role: str) -> List[Dict]:
    """Keyword-match role against local fallback dictionary."""
    rl = role.lower()
    for key, skills in LOCAL_FALLBACK.items():
        if key in rl or rl in key:
            print(f"[Local Fallback] '{role}' → matched '{key}' ({len(skills)} skills)")
            return skills
    print(f"[Local Fallback] '{role}' → no match")
    return []


def _get_seed_skills(role: str) -> List[Dict]:
    """Hardcoded defaults to ensure core skills always appear."""
    r = role.lower()
    if any(k in r for k in ["security", "infosec", "cyber", "analyst"]):
        return [
            {"name": "Cybersecurity", "level": "beginner"},
            {"name": "Network Security", "level": "beginner"},
            {"name": "Ethical Hacking", "level": "intermediate"},
            {"name": "SIEM / SOC", "level": "intermediate"},
            {"name": "Incident Response", "level": "intermediate"},
            {"name": "Cloud Security", "level": "advanced"},
        ]
    if any(k in r for k in ["devops", "sre", "platform"]):
        return [
            {"name": "Linux / Unix Shell", "level": "beginner"},
            {"name": "Docker / Containers", "level": "beginner"},
            {"name": "CI/CD Pipelines", "level": "intermediate"},
            {"name": "Terraform / IaC", "level": "intermediate"},
            {"name": "Kubernetes", "level": "advanced"},
        ]
    if any(k in r for k in ["accountant", "chartered", "finance manager"]):
        return [
            {"name": "Financial Accounting", "level": "beginner"},
            {"name": "Tally Prime / ERP 9", "level": "beginner"},
            {"name": "Income Tax & GST", "level": "intermediate"},
            {"name": "Audit & Assurance", "level": "intermediate"},
            {"name": "Advanced MS Excel", "level": "intermediate"},
            {"name": "Financial Modeling", "level": "advanced"},
            {"name": "SAP FICO / ERP", "level": "advanced"},
        ]
    if any(k in r for k in ["data sci", "data scientist", "machine learning", "ml engineer"]):
        return [
            {"name": "Python for Data Science", "level": "beginner", "category": "Programming"},
            {"name": "SQL & Relational Databases", "level": "beginner", "category": "Database"},
            {"name": "Statistics & Probability", "level": "beginner", "category": "Mathematics"},
            {"name": "Data Visualization (Tableau/PowerBI)", "level": "intermediate", "category": "BI Tools"},
            {"name": "Pandas & Numpy", "level": "intermediate", "category": "Data Analysis"},
            {"name": "Machine Learning Foundations", "level": "intermediate", "category": "Algorithms"},
            {"name": "MongoDB / NoSQL", "level": "advanced", "category": "Database"},
            {"name": "Deep Learning (PyTorch/TF)", "level": "advanced", "category": "AI"},
            {"name": "MLOps & Cloud (AWS/GCP)", "level": "advanced", "category": "System"}
        ]
    return []

def resolve_skills(role: str, location: str = "India", num_jobs: int = 8, refresh: bool = False) -> Tuple[List[Dict], str]:
    """
    Returns (skills_with_levels, source_label).
    refresh: if True, bypass MongoDB cache for this request.
    """
    # ... logic below will use this ...

    # --------------------------------------------------------------------------
    role = normalize_role(role)
    print(f"\n[RESOLVE] Attempting to find skills for '{role}' in '{location}'...", file=sys.stderr)

    # 1. O*NET API (Priority 1 - structured, reliable data)
    # --------------------------------------------------------------------------
    onet_skills = []
    if _onet.available:
        onet_skills = _onet.get_role_skills(role)
    
    # ── 2. Blend with Seed Skills ─────────────────────────────────────────────
    seed = _get_seed_skills(role)
    
    # Merge O*NET + Seed
    seen = set()
    merged = []
    for s in seed + onet_skills:
        key = s["name"].lower().strip()
        if key not in seen:
            seen.add(key)
            merged.append(s)
            
    # ── 3. Mandatory Level Sorting (Beginner -> Intermediate -> Advanced) ─────
    LEVEL_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}
    merged.sort(key=lambda s: LEVEL_ORDER.get(s.get("level", "intermediate"), 1))

    if merged:
        return merged[:25], "onet-plus-seed"

    # ── 2. Adzuna live JDs + NLP extraction (Dynamic secondary) ───────────────
    skills = _get_scraped_skills(role, location, num_jobs)
    if skills:
        return skills, "adzuna-live-nlp"

    # ── 3. Static catalogue (Offline backup) ──────────────────────────────────
    skills = _get_catalogue_skills(role)
    if skills:
        return skills, "static-catalogue"

    # ── 4. Local JSON fallback ────────────────────────────────────────────────
    skills = _get_local_fallback_skills(role)
    if skills:
        return skills, "local-fallback"

    # ── 5. Generic skeleton (last resort) ────────────────────────────────────
    print(f"[resolve_skills] No source matched '{role}' — building generic skeleton")
    return [
        {"name": f"{role} Fundamentals",     "level": "beginner"},
        {"name": "Communication",            "level": "beginner"},
        {"name": "MS Office / Google Suite", "level": "beginner"},
        {"name": f"Core {role} Tools",       "level": "intermediate"},
        {"name": f"Applied {role} Practice", "level": "intermediate"},
        {"name": "Project Management",       "level": "intermediate"},
        {"name": f"Advanced {role}",         "level": "advanced"},
        {"name": "Industry Best Practices",  "level": "advanced"},
    ], "generic-skeleton"


# ─────────────────────────────────────────────────────────────────────────────
#  Static curated resource catalogue
# ─────────────────────────────────────────────────────────────────────────────
TIERED_RESOURCES: Dict[str, Dict[str, List[Dict]]] = {
    "Python": {
        "beginner":     [{"title": "Python Official Tutorial",         "url": "https://docs.python.org/3/tutorial/"},
                         {"title": "Automate the Boring Stuff (free)", "url": "https://automatetheboringstuff.com/"},
                         {"title": "freeCodeCamp Python",              "url": "https://www.freecodecamp.org/learn/scientific-computing-with-python/"}],
        "intermediate": [{"title": "Real Python",                      "url": "https://realpython.com/"},
                         {"title": "Fluent Python (O'Reilly)",         "url": "https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/"}],
        "advanced":     [{"title": "High Performance Python",          "url": "https://www.oreilly.com/library/view/high-performance-python/9781492055013/"}],
    },
    "JavaScript": {
        "beginner":     [{"title": "JavaScript.info",                  "url": "https://javascript.info/"},
                         {"title": "MDN JavaScript Guide",             "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"}],
        "intermediate": [{"title": "You Don't Know JS (free)",         "url": "https://github.com/getify/You-Dont-Know-JS"},
                         {"title": "JavaScript30",                     "url": "https://javascript30.com/"}],
        "advanced":     [{"title": "Patterns.dev",                     "url": "https://www.patterns.dev/"}],
    },
    "TypeScript": {
        "beginner":     [{"title": "TypeScript Handbook",              "url": "https://www.typescriptlang.org/docs/handbook/intro.html"},
                         {"title": "Total TypeScript – Beginner",      "url": "https://www.totaltypescript.com/tutorials/beginners-typescript"}],
        "intermediate": [{"title": "TypeScript Deep Dive (free)",      "url": "https://basarat.gitbook.io/typescript/"}],
        "advanced":     [{"title": "Total TypeScript – Advanced",      "url": "https://www.totaltypescript.com/workshops/advanced-typescript-patterns"}],
    },
    "React": {
        "beginner":     [{"title": "React Official Docs",              "url": "https://react.dev/learn"},
                         {"title": "Scrimba Learn React",              "url": "https://scrimba.com/learn/learnreact"}],
        "intermediate": [{"title": "Epic React by Kent C. Dodds",      "url": "https://epicreact.dev/"}],
        "advanced":     [{"title": "Patterns.dev – React Patterns",    "url": "https://www.patterns.dev/react"}],
    },
    "SQL": {
        "beginner":     [{"title": "SQLZoo",                           "url": "https://sqlzoo.net/"},
                         {"title": "Mode SQL Tutorial",                "url": "https://mode.com/sql-tutorial/"}],
        "intermediate": [{"title": "Use The Index, Luke",              "url": "https://use-the-index-luke.com/"}],
        "advanced":     [{"title": "CMU Database Systems",             "url": "https://15445.courses.cs.cmu.edu/"},
                         {"title": "Designing Data-Intensive Apps",    "url": "https://dataintensive.net/"}],
    },
    "Docker": {
        "beginner":     [{"title": "Docker Official Docs",             "url": "https://docs.docker.com/get-started/"},
                         {"title": "Play with Docker",                 "url": "https://labs.play-with-docker.com/"}],
        "intermediate": [{"title": "Docker Compose Docs",              "url": "https://docs.docker.com/compose/"}],
        "advanced":     [{"title": "BuildKit Advanced Features",       "url": "https://docs.docker.com/build/buildkit/"}],
    },
    "Kubernetes": {
        "beginner":     [{"title": "Kubernetes Basics",                "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/"}],
        "intermediate": [{"title": "Kubernetes in Action",             "url": "https://www.manning.com/books/kubernetes-in-action-second-edition"}],
        "advanced":     [{"title": "Production Kubernetes",            "url": "https://www.oreilly.com/library/view/production-kubernetes/9781492092292/"}],
    },
    "AWS": {
        "beginner":     [{"title": "AWS Cloud Practitioner Essentials","url": "https://explore.skillbuilder.aws/learn/course/external/view/elearning/134/aws-cloud-practitioner-essentials"}],
        "intermediate": [{"title": "AWS CDK Workshop",                 "url": "https://cdkworkshop.com/"}],
        "advanced":     [{"title": "AWS re:Invent",                    "url": "https://www.youtube.com/@AWSEventsChannel"}],
    },
    "Machine Learning": {
        "beginner":     [{"title": "Andrew Ng ML Specialization",      "url": "https://www.coursera.org/specializations/machine-learning-introduction"},
                         {"title": "Google ML Crash Course",           "url": "https://developers.google.com/machine-learning/crash-course"}],
        "intermediate": [{"title": "Hands-On ML (Scikit-Learn + TF)", "url": "https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/"},
                         {"title": "Kaggle Learn",                     "url": "https://www.kaggle.com/learn"}],
        "advanced":     [{"title": "CS229 Stanford ML",                "url": "https://cs229.stanford.edu/"}],
    },
    "Deep Learning": {
        "beginner":     [{"title": "DeepLearning.AI Specialization",   "url": "https://www.coursera.org/specializations/deep-learning"},
                         {"title": "fast.ai Practical Deep Learning",  "url": "https://course.fast.ai/"}],
        "intermediate": [{"title": "Dive into Deep Learning",          "url": "https://d2l.ai/"}],
        "advanced":     [{"title": "Full Stack Deep Learning",         "url": "https://fullstackdeeplearning.com/"}],
    },
    "Statistics": {
        "beginner":     [{"title": "Khan Academy Statistics",          "url": "https://www.khanacademy.org/math/statistics-probability"},
                         {"title": "StatQuest (YouTube)",              "url": "https://www.youtube.com/@statquest"}],
        "intermediate": [{"title": "Think Stats (free)",               "url": "https://greenteapress.com/wp/think-stats-2e/"}],
        "advanced":     [{"title": "OpenIntro Statistics",             "url": "https://www.openintro.org/book/os/"}],
    },
    "Linear Algebra": {
        "beginner":     [{"title": "3Blue1Brown – Essence of LA",      "url": "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab"},
                         {"title": "Khan Academy Linear Algebra",      "url": "https://www.khanacademy.org/math/linear-algebra"}],
        "intermediate": [{"title": "MIT 18.06 Gilbert Strang",         "url": "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/"}],
        "advanced":     [{"title": "The Matrix Cookbook",              "url": "https://www.math.uwaterloo.ca/~hwolkowi/matrixcookbook.pdf"}],
    },
    "Git": {
        "beginner":     [{"title": "Learn Git Branching",              "url": "https://learngitbranching.js.org/"},
                         {"title": "Git Official Docs",                "url": "https://git-scm.com/doc"}],
        "intermediate": [{"title": "Atlassian Git Tutorials",          "url": "https://www.atlassian.com/git/tutorials"}],
        "advanced":     [{"title": "Pro Git Book (free)",              "url": "https://git-scm.com/book/en/v2"}],
    },
    "Linux": {
        "beginner":     [{"title": "Linux Journey",                    "url": "https://linuxjourney.com/"}],
        "intermediate": [{"title": "Linux Command Line (free book)",   "url": "https://linuxcommand.org/tlcl.php"}],
        "advanced":     [{"title": "Linux Kernel Development",         "url": "https://www.oreilly.com/library/view/linux-kernel-development/9780768696974/"}],
    },
    "Excel": {
        "beginner":     [{"title": "Microsoft Excel Training",         "url": "https://support.microsoft.com/en-us/excel"}],
        "intermediate": [{"title": "ExcelJet – Formulas Guide",        "url": "https://exceljet.net/"}],
        "advanced":     [{"title": "Power Query & Power Pivot",        "url": "https://www.myonlinetraininghub.com/excel-power-query-tutorial"}],
    },
    "Financial Accounting": {
        "beginner":     [{"title": "Accounting Basics – Coursera",     "url": "https://www.coursera.org/learn/financial-accounting"},
                         {"title": "Khan Academy – Accounting",        "url": "https://www.khanacademy.org/economics-finance-domain/core-finance/accounting-and-financial-stateme"}],
        "intermediate": [{"title": "CPA Study – Becker",               "url": "https://www.becker.com/cpa-review"}],
        "advanced":     [{"title": "IFRS Standards",                   "url": "https://www.ifrs.org/issued-standards/"}],
    },
    "Clinical Diagnosis": {
        "beginner":     [{"title": "Medscape – Clinical Tools",        "url": "https://www.medscape.com/"},
                         {"title": "Coursera – Clinical Skills",       "url": "https://www.coursera.org/search?query=clinical+diagnosis"}],
        "intermediate": [{"title": "BMJ Learning",                     "url": "https://new-learning.bmj.com/"}],
        "advanced":     [{"title": "UpToDate Clinical",                "url": "https://www.uptodate.com/"}],
    },
    "Pharmacology": {
        "beginner":     [{"title": "Khan Academy Pharmacology",        "url": "https://www.khanacademy.org/science/health-and-medicine/pharmacology"}],
        "intermediate": [{"title": "Goodman & Gilman's Pharmacology",  "url": "https://accesspharmacy.mhmedical.com/book.aspx?bookID=2189"}],
        "advanced":     [{"title": "Clinical Pharmacology",            "url": "https://ascpt.onlinelibrary.wiley.com/journal/15326535"}],
    },
    "Data Visualization": {
        "beginner":     [{"title": "Storytelling with Data",           "url": "https://www.storytellingwithdata.com/"},
                         {"title": "Kaggle Data Visualization",        "url": "https://www.kaggle.com/learn/data-visualization"}],
        "intermediate": [{"title": "Seaborn Tutorial",                 "url": "https://seaborn.pydata.org/tutorial.html"}],
        "advanced":     [{"title": "From Data to Viz",                 "url": "https://www.data-to-viz.com/"}],
    },
    "Power BI": {
        "beginner":     [{"title": "Microsoft Power BI Learning",      "url": "https://learn.microsoft.com/en-us/training/powerplatform/power-bi"}],
        "intermediate": [{"title": "SQLBI – DAX Introduction",         "url": "https://www.sqlbi.com/guides/dax/"}],
        "advanced":     [{"title": "DAX Guide",                        "url": "https://dax.guide/"}],
    },
    "Figma": {
        "beginner":     [{"title": "Figma Official Learn",             "url": "https://www.figma.com/resources/learn-design/"},
                         {"title": "Figma Crash Course (YouTube)",     "url": "https://www.youtube.com/results?search_query=figma+crash+course+beginners"}],
        "intermediate": [{"title": "Figma Advanced – UI Design",       "url": "https://www.youtube.com/results?search_query=figma+advanced+ui+design"}],
        "advanced":     [{"title": "Design Systems with Figma",        "url": "https://www.designsystems.com/"}],
    },
    "System Design": {
        "beginner":     [{"title": "System Design Primer",             "url": "https://github.com/donnemartin/system-design-primer"}],
        "intermediate": [{"title": "Grokking System Design",           "url": "https://www.designgurus.io/course/grokking-the-system-design-interview"}],
        "advanced":     [{"title": "Designing Data-Intensive Apps",    "url": "https://dataintensive.net/"}],
    },
    "Anatomy": {
        "beginner":     [{"title": "Khan Academy Anatomy",             "url": "https://www.khanacademy.org/science/health-and-medicine/human-anatomy-and-physiology"},
                         {"title": "Visible Body (3D Atlas)",          "url": "https://www.visiblebody.com/"}],
        "intermediate": [{"title": "Gray's Anatomy for Students",      "url": "https://www.elsevier.com/books/grays-anatomy-for-students/drake/978-0-323-39304-1"}],
        "advanced":     [{"title": "Netter's Atlas",                   "url": "https://www.elsevier.com/books/netters-atlas-of-human-anatomy/netter/978-0-323-54485-0"}],
    },
    "Legal Research": {
        "beginner":     [{"title": "Cornell LII",                      "url": "https://www.law.cornell.edu/"}],
        "intermediate": [{"title": "Westlaw",                          "url": "https://legalsolutions.thomsonreuters.com/en/westlaw.html"}],
        "advanced":     [{"title": "SSRN Legal Papers",                "url": "https://www.ssrn.com/index.cfm/en/lsn/"}],
    },
    "Terraform": {
        "beginner":     [{"title": "HashiCorp – Get Started",          "url": "https://developer.hashicorp.com/terraform/tutorials/aws-get-started"}],
        "intermediate": [{"title": "Terraform Up & Running",           "url": "https://www.terraformupandrunning.com/"}],
        "advanced":     [{"title": "Terraform Advanced HCL",           "url": "https://developer.hashicorp.com/terraform/language"}],
    },
    "Design Thinking": {
        "beginner":     [{"title": "IDEO Design Thinking",             "url": "https://designthinking.ideo.com/"},
                         {"title": "Stanford d.school Crash Course",   "url": "https://dschool.stanford.edu/resources"}],
        "intermediate": [{"title": "Nielsen Norman – UX Training",     "url": "https://www.nngroup.com/training/"}],
        "advanced":     [{"title": "IDEO U – Creative Confidence",     "url": "https://www.ideou.com/"}],
    },
    "Food Safety & Hygiene": {
        "beginner":     [{"title": "ServSafe Food Handler",            "url": "https://www.servsafe.com/food-handler"},
                         {"title": "WHO Food Safety",                  "url": "https://www.who.int/news-room/fact-sheets/detail/food-safety"}],
        "intermediate": [{"title": "HACCP Training",                   "url": "https://www.foodsafetymanager.com/"}],
        "advanced":     [{"title": "FDA Food Safety Modernization",    "url": "https://www.fda.gov/food/food-safety-modernization-act-fsma"}],
    },
}


def _platform_resources(skill: str, level: str, role: str = "") -> List[Dict]:
    q      = quote_plus(skill)
    rq     = quote_plus(role) if role else ""
    tier_q = {"beginner": "beginner+tutorial", "intermediate": "intermediate+course",
               "advanced": "advanced+production"}.get(level, "tutorial")
    return [
        {"title": f"{skill} tutorial (YouTube)", "url": f"https://www.youtube.com/results?search_query={q}+{tier_q}"},
        {"title": f"{skill} course (Coursera)",  "url": f"https://www.coursera.org/search?query={q}+{rq}".rstrip("+")},
        {"title": f"{skill} course (Udemy)",     "url": f"https://www.udemy.com/courses/search/?q={q}"},
    ]


def _role_specific_resources(skill: str, level: str, role: str = "") -> List[Dict]:
    q        = quote_plus(skill)
    role_q   = quote_plus(role) if role else ""
    tier_q   = {"beginner": "beginner tutorial roadmap", "intermediate": "intermediate projects roadmap",
                 "advanced": "advanced interview production"}.get(level, "tutorial roadmap")
    combined = "+".join([p for p in [role_q, q, quote_plus(tier_q)] if p])
    
    is_tech = _is_tech_role(role)
    resources = []
    
    # 1. Best: Try to get a real YouTube video instead of a search page
    yt_query = f"{role} {skill} {tier_q}"
    yt_url = _fetch_first_youtube_video(yt_query)
    if yt_url:
        resources.append({"title": f"Video: {skill} {level} guide (YouTube)", "url": yt_url})
    else:
        resources.append({"title": f"{skill} roadmap (YouTube Search)", "url": f"https://www.youtube.com/results?search_query={combined}"})

    # 2. Add Roadmap.sh if applicable
    rm_url = _get_roadmap_sh_url(skill) or _get_roadmap_sh_url(role)
    if rm_url:
        resources.append({"title": f"Industry Roadmap: {skill} (roadmap.sh)", "url": rm_url})

    # 3. Add Google search as a secondary fallback
    resources.append({"title": f"Google Search: {skill} {level} resources", "url": f"https://www.google.com/search?q={combined}"})
    
    if is_tech:
        resources.append({"title": f"GitHub: {skill} projects & repositories", 
                          "url": f"https://github.com/search?q={combined}&type=repositories"})
    else:
        resources.append({"title": f"LinkedIn: {skill} community insights", 
                          "url": f"https://www.linkedin.com/search/results/all/?keywords={combined}"})
        
    return resources


def _merge_resource_lists(*resource_lists: List[Dict], limit: int = 4) -> List[Dict]:
    merged: List[Dict] = []
    seen = set()
    for items in resource_lists:
        for item in items or []:
            title = str(item.get("title", "")).strip()
            url   = str(item.get("url",   "")).strip()
            if not title or not url:
                continue
            key = (title.lower(), url.lower())
            if key in seen:
                continue
            seen.add(key)
            merged.append({"title": title, "url": url})
            if len(merged) >= limit:
                return merged
    return merged


def get_resources(skill: str, level: str, role: str = "") -> List[Dict]:
    """Lookup resources: curated catalogue → role-specific → platform fallback."""
    if skill in TIERED_RESOURCES:
        static = TIERED_RESOURCES[skill].get(level, [])
        return _merge_resource_lists(static, _role_specific_resources(skill, level, role),
                                     _platform_resources(skill, level, role), limit=4)
    sl = skill.lower()
    for key, tiers in TIERED_RESOURCES.items():
        if sl in key.lower() or key.lower() in sl:
            static = tiers.get(level, [])
            return _merge_resource_lists(static, _role_specific_resources(skill, level, role),
                                         _platform_resources(skill, level, role), limit=4)
    return _merge_resource_lists(_role_specific_resources(skill, level, role),
                                  _platform_resources(skill, level, role), limit=4)


# ─────────────────────────────────────────────────────────────────────────────
#  Phase builder helpers
# ─────────────────────────────────────────────────────────────────────────────
def _build_capstone_resources(intermediates, advanced_list, role, rc):
    resources = []
    is_tech = _is_tech_role(role)
    for sd in (intermediates + advanced_list)[:3]:
        res = get_resources(sd["name"], sd["level"], role)
        resources.append({"skill": sd["name"], "tier": sd["level"], "resources": res[:2]})
    
    if is_tech:
        resources.append({"skill": "Git", "tier": "intermediate",
                           "resources": get_resources("Git", "intermediate", role)[:2]})
    else:
        # Specialized professional portfolio/credentialing info
        resources.append({"skill": f"{rc} Certification", "tier": "intermediate",
                           "resources": _platform_resources(f"{role} professional certification", "intermediate", role)[:2]})
        
    resources.append({"skill": "Experience Documentation", "tier": "intermediate",
                       "resources": _platform_resources("how to document professional experience", "intermediate", role)[:2]})
    return resources[:5]


def _build_interview_tasks(role, rc):
    tasks = [f"Domain-specific {rc} interview preparation"]
    if _is_tech_role(role):
        tasks.append("Data structures & algorithms (LeetCode / NeetCode)")
    else:
        tasks.append(f"Domain case studies and {rc} role-play simulations")
    tasks.extend(["Mock interviews (video or peer-to-peer)",
                  "Behavioural questions (STAR method)",
                  "Portfolio / CV / resume review"])
    return tasks


def _build_interview_resources(role, rc):
    q         = quote_plus(role)
    resources = []
    if _is_tech_role(role):
        resources.append({"skill": "DSA", "tier": "intermediate",
                           "resources": [{"title": "NeetCode 150", "url": "https://neetcode.io/practice"},
                                         {"title": "LeetCode",     "url": "https://leetcode.com/"}]})
        resources.append({"skill": "Mock Interviews", "tier": "advanced",
                           "resources": [{"title": "Pramp",           "url": "https://www.pramp.com/"},
                                         {"title": "Interviewing.io", "url": "https://interviewing.io/"}]})
    else:
        resources.append({"skill": f"{rc} Case Studies", "tier": "intermediate",
                           "resources": [{"title": f"{rc} case study interview (YouTube)",
                                          "url": f"https://www.youtube.com/results?search_query={q}+case+study+interview"},
                                         {"title": f"{rc} mock interview prep (YouTube)",
                                          "url": f"https://www.youtube.com/results?search_query={q}+mock+interview"}]})
    resources.append({"skill": "Domain Prep", "tier": "advanced",
                       "resources": [{"title": f"{rc} Interview Questions – Glassdoor",
                                       "url": (f"https://www.glassdoor.com/Interview/"
                                               f"{role.replace(' ', '-')}-interview-questions-SRCH_KO0,{len(role)}.htm")},
                                      {"title": f"{rc} Interview Questions – YouTube",
                                       "url": f"https://www.youtube.com/results?search_query={q}+interview+questions+answers"},
                                      {"title": "STAR Method Guide",
                                       "url": "https://www.themuse.com/advice/star-interview-method"}]})
    return resources


# ─────────────────────────────────────────────────────────────────────────────
#  Phase builder
# ─────────────────────────────────────────────────────────────────────────────
def build_phases(skills_with_levels: List[Dict], role: str) -> List[Dict]:
    """Build a 6-phase roadmap from skill difficulty levels."""
    beginners     = [s for s in skills_with_levels if s["level"] == "beginner"]
    intermediates = [s for s in skills_with_levels if s["level"] == "intermediate"]
    advanced_list = [s for s in skills_with_levels if s["level"] == "advanced"]

    if not beginners:
        beginners     = skills_with_levels[:2] or [{"name": f"{role} Basics",  "level": "beginner"}]
    if not intermediates:
        intermediates = skills_with_levels[2:5] or [{"name": f"Core {role}",   "level": "intermediate"}]
    if not advanced_list:
        advanced_list = skills_with_levels[5:] or  [{"name": f"Advanced {role}","level": "advanced"}]

    mid    = max(1, (len(beginners) + 1) // 2)
    phase0 = beginners[:mid]
    phase1 = beginners[mid:] or beginners[:1]

    def R(sd: Dict) -> Dict:
        res = get_resources(sd["name"], sd["level"], role)
        return {"skill": sd["name"], "tier": sd["level"], "resources": res[:3]}

    capstone_names = [s["name"] for s in (intermediates + advanced_list)[:3]]
    rc = role.title()

    is_tech = _is_tech_role(role)
    phase5_title = "Capstone Projects" if is_tech else "Field Case Studies"
    phase5_desc  = (f"2–3 portfolio-quality {rc} projects with documentation." if is_tech 
                    else f"Review 2–3 real-world {rc} case studies and simulate response protocols.")
    
    phase5_tasks = [f"Build a real-world project using {', '.join(capstone_names)}",
                    "Document your process and decisions",
                    "Deploy or publish your work publicly",
                    "Write a README / case study with diagrams"] if is_tech else [
                    f"Analyze real-world scenarios involving {', '.join(capstone_names)}",
                    "Draft incident reports or operational plans",
                    "Simulate field response / decision-making protocols",
                    "Build a portfolio of case study solutions"]

    return [
        {"title": "Foundations",       "duration": "4–8 weeks",   "description": f"Core concepts and first steps for {rc}.",
         "tasks": [f"[{s.get('category', 'Concept')}] {s['name']}" if s.get('category') else s['name'] for s in phase0], 
         "resources": [R(s) for s in phase0]},
        {"title": "Core Tooling",      "duration": "4–8 weeks",   "description": f"Expand the {rc} toolkit with remaining foundational skills.",
         "tasks": [f"[{s.get('category', 'Tool')}] {s['name']}" if s.get('category') else s['name'] for s in phase1], 
         "resources": [R(s) for s in phase1]},
        {"title": "Intermediate Skills","duration": "8–12 weeks",  "description": f"Practical, scenario-based proficiency with the core {rc} toolchain.",
         "tasks": [f"[{s.get('category', 'App')}] {s['name']}" if s.get('category') else s['name'] for s in intermediates], 
         "resources": [R(s) for s in intermediates]},
        {"title": "Advanced Mastery",  "duration": "8–12 weeks",  "description": f"Professional-grade patterns and advanced techniques for {rc}.",
         "tasks": [f"[{s.get('category', 'System')}] {s['name']}" if s.get('category') else s['name'] for s in advanced_list], 
         "resources": [R(s) for s in advanced_list]},
        {"title": phase5_title, "duration": "4–8 weeks",   "description": phase5_desc,
         "tasks": phase5_tasks + ["Seek feedback or contribute to a community"],
         "resources": _build_capstone_resources(intermediates, advanced_list, role, rc)},
        {"title": "Interview Preparation","duration": "4–6 weeks", "description": f"Land the {rc} role — domain prep, problem solving, and behavioural interviews.",
         "tasks": _build_interview_tasks(role, rc), "resources": _build_interview_resources(role, rc)},
    ]


# ─────────────────────────────────────────────────────────────────────────────
#  JOB LISTINGS
# ─────────────────────────────────────────────────────────────────────────────
def _estimate_deadline(min_d: int = 5, max_d: int = 21) -> str:
    days = random.randint(min_d, max_d)
    return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_jobs_serpapi(role: str, location: str, limit: int = 10) -> List[Dict]:
    key = os.environ.get("SERPAPI_KEY", "")
    if not key:
        return []
    print(f"[SerpAPI] Fetching Google Jobs for '{role}' in '{location}'...")
    try:
        params = {"engine": "google_jobs", "q": f"{role} jobs", "location": location,
                  "hl": "en", "api_key": key, "num": str(min(limit, 10))}
        r = requests.get(SERPAPI_BASE, params=params, timeout=15)
        if r.status_code != 200:
            return []
        jobs_raw = r.json().get("jobs_results", [])
        jobs: List[Dict] = []
        for j in jobs_raw[:limit]:
            apply_options = j.get("apply_options", [])
            apply_url     = apply_options[0].get("link", "") if apply_options else ""
            ext      = j.get("detected_extensions", {})
            deadline = ext.get("posted_at", "") or _estimate_deadline()
            jobs.append({"title": j.get("title", role)[:80], "company": j.get("company_name", "Company")[:60],
                          "location": j.get("location", location)[:60], "description": j.get("description", "")[:300],
                          "source": "google-jobs", "applyUrl": apply_url, "deadline": deadline})
        print(f"[SerpAPI] Got {len(jobs)} jobs")
        return jobs
    except Exception as e:
        print(f"[SerpAPI] Error: {e}")
        return []


def fetch_jobs_adzuna(role: str, location: str, limit: int = 10) -> List[Dict]:
    app_id  = os.environ.get("ADZUNA_APP_ID", "")
    app_key = os.environ.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        return []
    country_map = {"india": "in", "united states": "us", "usa": "us", "uk": "gb",
                   "united kingdom": "gb", "australia": "au", "canada": "ca",
                   "germany": "de", "france": "fr", "singapore": "sg"}
    country = country_map.get(location.lower().strip(), "in")
    print(f"[Adzuna] Fetching jobs for '{role}' ({country})...")
    try:
        url    = f"{ADZUNA_BASE}/{country}/search/1"
        params = {"app_id": app_id, "app_key": app_key, "what": role, "where": location,
                  "results_per_page": min(limit, 20), "content-type": "application/json"}
        r = requests.get(url, params=params, timeout=15)
        if r.status_code != 200:
            return []
        results = r.json().get("results", [])
        jobs: List[Dict] = []
        for j in results[:limit]:
            created  = j.get("created", "")
            deadline = ""
            if created:
                try:
                    dt       = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    deadline = (dt + timedelta(days=21)).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:
                    deadline = _estimate_deadline()
            else:
                deadline = _estimate_deadline()
            jobs.append({"title": j.get("title", role)[:80],
                          "company": j.get("company", {}).get("display_name", "Company")[:60],
                          "location": j.get("location", {}).get("display_name", location)[:60],
                          "description": j.get("description", "")[:300], "source": "adzuna",
                          "applyUrl": j.get("redirect_url", ""), "deadline": deadline})
        print(f"[Adzuna] Got {len(jobs)} jobs")
        return jobs
    except Exception as e:
        print(f"[Adzuna] Error: {e}")
        return []


def fetch_jobs_indeed_rss(role: str, location: str, limit: int = 10) -> List[Dict]:
    print(f"[Indeed RSS] Fetching for '{role}' in '{location}'...")
    try:
        q    = quote_plus(role)
        loc  = quote_plus(location)
        base = "https://in.indeed.com" if "india" in location.lower() else "https://www.indeed.com"
        url  = f"{base}/rss?q={q}&l={loc}&sort=date"
        r    = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        root  = ET.fromstring(r.content)
        items = root.findall(".//item")
        jobs: List[Dict] = []
        for item in items[:limit]:
            title   = item.findtext("title", "").strip()
            link    = item.findtext("link",  "").strip()
            pub     = item.findtext("pubDate", "").strip()
            source  = item.findtext("source", "").strip()
            company = ""
            if " - " in title:
                parts   = title.rsplit(" - ", 1)
                title   = parts[0].strip()
                company = parts[1].strip()
            deadline = ""
            if pub:
                try:
                    from email.utils import parsedate_to_datetime
                    dt       = parsedate_to_datetime(pub)
                    deadline = (dt + timedelta(days=14)).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:
                    deadline = _estimate_deadline()
            else:
                deadline = _estimate_deadline()
            if title and link:
                jobs.append({"title": title[:80], "company": company[:60] or source[:60] or "Company",
                              "location": location[:60], "description": "", "source": "indeed",
                              "applyUrl": link, "deadline": deadline})
        print(f"[Indeed RSS] Got {len(jobs)} jobs")
        return jobs
    except Exception as e:
        print(f"[Indeed RSS] Error: {e}")
        return []


def smart_job_links(role: str, location: str) -> List[Dict]:
    q   = quote_plus(role)
    loc = quote_plus(location)
    return [
        {"title": f"{role} jobs on Naukri",    "company": "Naukri.com",    "location": location,
         "description": f"Latest {role} openings on Naukri", "source": "naukri-link",
         "applyUrl": f"https://www.naukri.com/{quote_plus(role.lower().replace(' ', '-'))}-jobs",
         "deadline": _estimate_deadline(3, 7)},
        {"title": f"{role} jobs on LinkedIn",  "company": "LinkedIn",      "location": location,
         "description": f"Recent {role} listings on LinkedIn Jobs", "source": "linkedin-link",
         "applyUrl": f"https://www.linkedin.com/jobs/search/?keywords={q}&location={loc}",
         "deadline": _estimate_deadline(3, 7)},
        {"title": f"{role} jobs on Indeed",    "company": "Indeed",        "location": location,
         "description": f"Search {role} jobs sorted by date", "source": "indeed-link",
         "applyUrl": f"https://in.indeed.com/jobs?q={q}&l={loc}&sort=date",
         "deadline": _estimate_deadline(3, 7)},
        {"title": f"{role} jobs on Glassdoor", "company": "Glassdoor",     "location": location,
         "description": f"{role} openings with salary insights", "source": "glassdoor-link",
         "applyUrl": f"https://www.glassdoor.com/Job/{quote_plus(role.lower())}-jobs-SRCH_KO0,{len(role)}.htm",
         "deadline": _estimate_deadline(3, 7)},
        {"title": f"{role} jobs on Google Jobs","company": "Google Jobs",  "location": location,
         "description": "Google Jobs aggregates listings from all boards", "source": "google-jobs-link",
         "applyUrl": f"https://www.google.com/search?q={q}+jobs+in+{loc}&ibp=htl;jobs",
         "deadline": _estimate_deadline(3, 7)},
    ]


def fetch_jobs(role: str, location: str = "India", limit: int = 10) -> List[Dict]:
    jobs: List[Dict] = []
    if not jobs:
        jobs = fetch_jobs_serpapi(role, location, limit)
    if len(jobs) < 3:
        jobs += fetch_jobs_adzuna(role, location, limit - len(jobs))
    if len(jobs) < 3:
        jobs += fetch_jobs_indeed_rss(role, location, limit - len(jobs))
    if len(jobs) < 3:
        jobs += smart_job_links(role, location)
    seen:   set       = set()
    unique: List[Dict] = []
    for j in jobs:
        key = (j.get("title", "").lower()[:40], j.get("company", "").lower()[:30])
        if key not in seen:
            seen.add(key)
            unique.append(j)
    return unique[:limit]


# ─────────────────────────────────────────────────────────────────────────────
#  Main orchestrator — with background cache refresh
# ─────────────────────────────────────────────────────────────────────────────
class RoadmapGenerator:

    def _build_fresh(self, role: str, location: str, num_jobs: int, cache_key: str, refresh: bool = False) -> Dict:
        """Generate a completely fresh roadmap and save to cache."""
        skills, source = resolve_skills(role, location, num_jobs, refresh=refresh)

        # PROMINENT LOG FOR SOURCE TRACKING
        print("\n" + "*"*60, file=sys.stderr)
        print(f"*** [DATA SOURCE] ROLE: {role} --> {source.upper()} ***", file=sys.stderr)
        print("*"*60 + "\n", file=sys.stderr)

        print(f"[Pipeline] Skills source: {source} | Count: {len(skills)}")

        phases = build_phases(skills, role)
        jobs   = fetch_jobs(role, location, num_jobs)
        print(f"[Pipeline] Jobs: {len(jobs)} listings")

        result = {
            "role":             role,
            "location":         location,
            "extracted_skills": [s["name"] for s in skills],
            "phases":           phases,
            "jobs":             jobs,
            "source":           source,
            "pipeline": (
                "v4-dynamic | "
                "skills: onet-api → adzuna-gemini-live → static-catalogue → local-fallback | "
                "jobs: serpapi → adzuna → indeed-rss → smart-links"
            ),
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }
        _cache.set(cache_key, result)
        print(f"[Pipeline] Done. Source={source}, Jobs={len(jobs)}")
        return result

    def _background_refresh(self, role: str, location: str, num_jobs: int, cache_key: str):
        """Silently refresh cache in background — caller gets stale data instantly."""
        def _run():
            print(f"[BgRefresh] Starting background refresh for '{role}'...")
            try:
                self._build_fresh(role, location, num_jobs, cache_key)
                print(f"[BgRefresh] ✓ Refresh complete for '{role}'")
            except Exception as e:
                print(f"[BgRefresh] ✗ Refresh failed for '{role}': {e}")
        t = threading.Thread(target=_run, daemon=True)
        t.start()

    def generate(self, role: str, location: str = "India", num_jobs: int = 10, refresh: bool = False) -> Dict:
        role      = normalize_role(role)
        cache_key = f"{role.lower()}::{location.lower()}"

        print(f"\n{'='*60}")
        print(f"[Pipeline] Role: '{role}' | Location: '{location}'")
        print(f"{'='*60}")

        # 1. Cache check
        if not refresh:
            cached = _cache.get(cache_key)
            if cached:
                # Check if cache is stale enough for a background refresh
                age = _cache.get_age_secs(cache_key)
                if age is not None and age > SKILL_REFRESH_AFTER_SECS:
                    print(f"[Pipeline] Cache hit (age {age/3600:.1f}h > {SKILL_REFRESH_AFTER_SECS/3600}h) "
                          f"— serving stale, refreshing in background")
                    self._background_refresh(role, location, num_jobs, cache_key)
                
                print("[Pipeline] Cache hit — returning instantly")
                return cached

        # 2. No cache or forced REFRESH — build fresh synchronously
        print(f"[Pipeline] {'REFRESH' if refresh else 'Cache miss'} — building fresh roadmap")
        return self._build_fresh(role, location, num_jobs, cache_key, refresh=refresh)


# ─────────────────────────────────────────────────────────────────────────────
#  Backward-compatibility wrappers
# ─────────────────────────────────────────────────────────────────────────────
class JobScraper:
    def scrape_job_skills(self, role: str, location: str = "India", num_jobs: int = 5) -> List[str]:
        skills, _ = resolve_skills(normalize_role(role), location, num_jobs)
        return [s.get("name", "") for s in skills[:max(1, int(num_jobs) * 3)] if s.get("name")]

    def get_live_jobs(self, role: str, location: str = "India", num_each: int = 5) -> List[Dict]:
        return fetch_jobs(normalize_role(role), location, int(num_each))

    def scrape_live_jobs(self, role: str, location: str = "India", num_each: int = 5) -> List[Dict]:
        return self.get_live_jobs(role, location, num_each)


class SkillResourcesScraper:
    def __init__(self):
        self._generator = RoadmapGenerator()

    def get_dynamic_role_resources(self, target_role: str, location: str = "India", num_jobs: int = 10, refresh: bool = False) -> Dict:
        return self._generator.generate(target_role, location, num_jobs, refresh=refresh)


# ─────────────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Universal Role Roadmap Generator v4 (Dynamic)")
    parser.add_argument("--role",       default="Data Scientist", help="Target role")
    parser.add_argument("--location",   default="India",          help="Job location")
    parser.add_argument("--num-jobs",   type=int, default=10,     help="Number of job listings")
    parser.add_argument("--json",       action="store_true",      help="Output raw JSON")
    parser.add_argument("--invalidate", action="store_true",      help="Clear cache for this role")
    args = parser.parse_args()

    gen = RoadmapGenerator()
    key = f"{args.role.lower()}::{args.location.lower()}"

    if args.invalidate:
        _cache.invalidate(key)

    result = gen.generate(args.role, args.location, args.num_jobs)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    print(f"\n{'='*60}")
    print(f"  ROADMAP: {result['role']} | {result['location']}")
    print(f"  Source : {result['source']}")
    print(f"  Skills : {len(result['extracted_skills'])}")
    print(f"{'='*60}")
    print(f"  Skills: {', '.join(result['extracted_skills'][:8])}{'...' if len(result['extracted_skills']) > 8 else ''}")
    print()
    PHASE_LABELS = ["Foundations", "Core Tooling", "Intermediate", "Advanced", "Capstone", "Interview Prep"]
    for i, phase in enumerate(result["phases"]):
        label = PHASE_LABELS[i] if i < len(PHASE_LABELS) else f"Phase {i}"
        print(f"  [{label}] {phase['title']} ({phase.get('duration','?')})")
        for t in phase["tasks"][:3]:
            print(f"    • {t}")
    print()
    print(f"  JOBS ({len(result['jobs'])} listings):")
    for j in result["jobs"][:5]:
        print(f"    [{j['source']}] {j['title']} @ {j['company']} — {j['location']}")
        if j.get("applyUrl"):
            print(f"      → {j['applyUrl'][:80]}")


if __name__ == "__main__":
    main()