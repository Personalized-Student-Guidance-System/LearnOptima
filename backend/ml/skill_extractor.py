"""
skill_extractor.py  ──  Dynamic NLP-based skill extraction from job descriptions
═══════════════════════════════════════════════════════════════════════════════════

Extracts skills from raw job-description text using three complementary methods:
  1. spaCy NER + noun-phrase chunking  (discovers unknown skills)
  2. Regex baseline pass               (catches well-known tech terms)
  3. N-gram frequency analysis         (surface domain-specific phrases)

Returns a ranked {skill: frequency} dict suitable for skill-gap analysis.

Dependencies:  spacy, en_core_web_sm model
Fallback:      If spaCy unavailable, uses regex-only extraction
"""

import re
import os
import sys
import json
import time
from collections import Counter
from typing import Dict, List, Optional, Set, Tuple
from pathlib import Path

# ── spaCy optional import ──────────────────────────────────────────────────────
_nlp = None
_SPACY_AVAILABLE = False

def _load_spacy():
    """Lazy-load spaCy and download model if needed."""
    global _nlp, _SPACY_AVAILABLE
    if _nlp is not None:
        return _nlp
    try:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm", disable=["lemmatizer"])
        except OSError:
            print("[SkillExtractor] Downloading spaCy en_core_web_sm model...", file=sys.stderr)
            from spacy.cli import download
            download("en_core_web_sm")
            _nlp = spacy.load("en_core_web_sm", disable=["lemmatizer"])
        _SPACY_AVAILABLE = True
        print("[SkillExtractor] ✓ spaCy loaded", file=sys.stderr)
        return _nlp
    except ImportError:
        print("[SkillExtractor] spaCy not installed — regex-only mode", file=sys.stderr)
        _SPACY_AVAILABLE = False
        return None


# ── Sentence-transformer optional import ─────────────────────────────────────
_st_model = None
_ST_AVAILABLE = False

def get_sentence_model():
    """Lazy-load sentence-transformers model for semantic matching."""
    global _st_model, _ST_AVAILABLE
    if _st_model is not None:
        return _st_model
    try:
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        _ST_AVAILABLE = True
        print("[SkillExtractor] ✓ Sentence-transformer loaded (all-MiniLM-L6-v2)", file=sys.stderr)
        return _st_model
    except ImportError:
        print("[SkillExtractor] sentence-transformers not installed — TF-IDF fallback", file=sys.stderr)
        _ST_AVAILABLE = False
        return None
    except Exception as e:
        print(f"[SkillExtractor] Sentence-transformer load error: {e}", file=sys.stderr)
        _ST_AVAILABLE = False
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Noise / stop words for filtering extracted phrases
# ─────────────────────────────────────────────────────────────────────────────
_STOP_PHRASES: Set[str] = {
    # Generic job description filler
    "experience", "years", "year", "work", "working", "team", "company",
    "job", "role", "position", "candidate", "candidates", "apply", "application",
    "salary", "benefit", "benefits", "location", "office", "remote", "hybrid",
    "full time", "full-time", "part time", "part-time", "internship", "fresher",
    "description", "requirement", "requirements", "responsibility", "responsibilities",
    "qualification", "qualifications", "education", "degree", "bachelor", "master",
    "graduate", "post graduate", "good", "strong", "excellent", "ability",
    "knowledge", "understanding", "proficiency", "hands-on", "hands on",
    "minimum", "maximum", "preferred", "required", "plus", "bonus",
    "day", "days", "month", "months", "week", "weeks", "hour", "hours",
    "posted", "ago", "today", "yesterday", "new", "latest", "recent",
    "similar", "related", "other", "more", "less", "also", "including",
    # ── Job board footers / legally required UI artifacts ──
    "privacy policy", "cookie policy", "user agreement", "terms of use",
    "terms of service", "all rights reserved", "copyright", "clear text",
    "equal opportunity", "employer", "accessibility", "accommodations",
    # ── Indian locations / sub-divisions ──
    "india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune",
    "chennai", "noida", "gurgaon", "gurugram", "kolkata", "ahmedabad",
    "karnataka", "maharashtra", "telangana", "tamil nadu", "uttar pradesh",
    "haryana", "west bengal", "gujarat", "rajasthan", "kerala", "madhya pradesh",
    "jaipur", "lucknow", "kochi", "chandigarh", "indore", "bhopal", "nagpur",
    "coimbatore", "visakhapatnam", "thiruvananthapuram", "mysore", "mangalore",
    "goa", "patna", "ranchi", "bhubaneswar", "dehradun", "surat", "vadodara",
    "division", "deutsche telekom", "wipro", "fedex", "infosys", "tcs", "cognizant",
    # Global locations
    "usa", "united states", "uk", "london", "singapore", "dubai", "canada",
    "germany", "australia", "japan", "china", "new york", "san francisco",
    "seattle", "boston", "toronto", "berlin", "amsterdam",
    # ── Job board / UI artifacts ──
    "naukri", "linkedin", "indeed", "monster", "glassdoor", "shine",
    "sign in", "sign up", "log in", "register", "search", "filter",
    "similar jobs", "new jobs", "more jobs", "apply now", "save job",
    "people also viewed", "you may also like", "view all", "show more",
    "easy apply", "quick apply", "actively hiring", "urgently hiring",
    "hiring", "actively", "urgently", "jobs",
    # ── Temporal / structural noise ──
    "days ago", "weeks ago", "months ago", "hours ago", "just now",
    "date posted", "closing date", "last date",
    # ── Generic nouns & roles that aren't skills ──
    "people", "person", "member", "members", "manager", "engineer", "engineering",
    "developer", "analyst", "scientist", "designer", "specialist", "quantitative",
    "associate", "senior", "junior", "lead", "head", "director", "vp",
    "staff", "intern", "trainee", "executive", "coordinator", "officer",
    "industry", "sector", "domain", "field", "area", "function",
    "client", "customer", "user", "partner", "vendor", "stakeholder",
    "business", "enterprise", "organization", "organisation", "intelligence",
    "project", "product", "service", "solution", "platform",
    "process", "system", "tool", "technology", "technique",
    "level", "type", "kind", "range", "scope", "scale",
    "opportunity", "growth", "culture", "environment", "impact",
    # ── Job market noise (Companies/Websites) ──
    "ebay", "srinsoft", "crossing hurdles", "naukri", "linkedin", "indeed",
    "glassdoor", "monster", "shine", "scoutit", "fedex", "wipro", "tcs",
    "infosys", "cognizant", "accenture", "deloitte", "capgemini", "hcl",
    "tech mahindra", "adobe", "google", "microsoft", "amazon", "apple",
    "meta", "netflix", "uber", "ola", "zomato", "swiggy", "flipkart",
    "paytm", "byjus", "unacademy", "upgrad", "simplilearn",
}

# Individual stop words — if ALL words in an n-gram are stop words, reject it
_STOP_WORDS: Set[str] = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must",
    "and", "or", "but", "if", "then", "else", "when", "where", "who",
    "what", "which", "that", "this", "these", "those", "it", "its",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "up", "down",
    "not", "no", "nor", "so", "very", "too", "also", "just", "only",
    "own", "same", "than", "other", "such", "each", "every", "all",
    "both", "few", "more", "most", "some", "any", "many", "much",
    "about", "how", "here", "there", "now", "ago", "per",
    "we", "our", "you", "your", "they", "their", "he", "she", "him", "her",
    "i", "me", "my", "mine", "us",
    # Common JD verbs & filler
    "looking", "seeking", "hiring", "join", "work", "build",
    "develop", "create", "design", "manage", "lead", "drive",
    "ensure", "deliver", "provide", "support", "maintain", "implement",
    "use", "using", "used", "based", "related", "required", "preferred",
    "strong", "good", "excellent", "minimum", "maximum", "plus",
    "new", "well", "able", "like", "within", "across", "jobs", "job",
    # Titles & Ranks
    "senior", "junior", "engineer", "developer", "manager", "lead", "staff", "intern",
    # Temporal & UI artifacts
    "days", "day", "weeks", "week", "months", "month", "years", "year",
    "hours", "hour", "ago", "today", "recently", "currently", "actively",
    "policy", "privacy", "cookie", "cookies", "agreement", "terms", "rights", "reserved",
    "copyright", "division", "fedex", "wipro", "telekom", "deutsche", "text", "clear",
    # Locations as single words
    "india", "bangalore", "bengaluru", "mumbai", "delhi", "pune", "hyderabad",
    "chennai", "noida", "gurgaon", "gurugram", "kolkata", "ahmedabad",
    "karnataka", "maharashtra", "telangana", "remote", "hybrid", "onsite",
}

_MIN_SKILL_LEN = 2
_MAX_SKILL_LEN = 50

# ─────────────────────────────────────────────────────────────────────────────
#  Regex baseline — catches well-known tech/domain terms
# ─────────────────────────────────────────────────────────────────────────────
_TECH_RE = re.compile(
    r"\b("
    # Programming languages
    r"python|javascript|typescript|java(?!script)(?!\.)|c\+\+|c#|go(?:lang)|rust|ruby|php|swift|kotlin|scala|"
    r"matlab|julia|perl|dart|lua|elixir|clojure|haskell|"
    # Frontend
    r"react(?:\.?js)?|angular|vue(?:\.?js)?|next\.?js|nuxt|svelte|jquery|"
    r"html5?|css3?|sass|scss|tailwind(?:css)?|bootstrap|material.?ui|"
    r"webpack|vite|"
    # Backend / Frameworks
    r"node\.?js|express(?:\.?js)?|django|flask|fastapi|spring\s?boot|rails|laravel|"
    r"asp\.?net|\.net\s?core|nestjs|"
    # Databases
    r"sql|mysql|postgresql|postgres|mongodb|redis|elasticsearch|cassandra|dynamodb|"
    r"sqlite|mariadb|neo4j|firestore|supabase|"
    # Cloud / DevOps
    r"aws|gcp|google cloud|azure|docker|kubernetes|k8s|terraform|ansible|"
    r"jenkins|github actions|gitlab ci|helm|"
    r"nginx|"
    # ML / AI / Data
    r"machine learning|deep learning|nlp|natural language processing|computer vision|"
    r"generative ai|llm|large language model|"
    r"tensorflow|pytorch|keras|scikit.?learn|sklearn|pandas|numpy|scipy|matplotlib|seaborn|"
    r"hugging.?face|langchain|openai|"
    r"spark|hadoop|kafka|airflow|dbt|"
    r"tableau|power.?bi|looker|grafana|prometheus|"
    r"snowflake|databricks|bigquery|redshift|"
    # Data science
    r"statistics|probability|linear algebra|"
    r"feature engineering|model evaluation|a/b testing|hypothesis testing|"
    r"data visualization|data analysis|data modeling|data warehousing|etl|"
    # Tools / Practices
    r"git|github|gitlab|"
    r"linux|bash|shell scripting|"
    r"rest\s?api|graphql|grpc|websocket|"
    r"microservices|serverless|"
    r"agile|scrum|kanban|devops|ci/?cd|"
    r"unit testing|integration testing|tdd|"
    r"selenium|cypress|jest|pytest|"
    r"jira|confluence|"
    r"figma|photoshop|illustrator|"
    # Quantum / Niche
    r"qiskit|cirq|quantum mechanics|quantum computing|quantum algorithms|"
    r"quantum error correction|"
    # Security
    r"owasp|penetration testing|siem|encryption|"
    r"threat modeling|incident response|"
    # Blockchain
    r"solidity|ethereum|smart contracts|web3|blockchain|"
    # Mobile
    r"react native|flutter|swiftui|jetpack compose|"
    r"android sdk|xcode|"
    # Domain: Finance
    r"financial accounting|auditing|direct tax|indirect tax|gst|"
    r"financial reporting|corporate law|cost accounting|tally|erp|"
    r"financial modeling|valuation|dcf|bloomberg|"
    # Domain: Medical
    r"clinical diagnosis|patient assessment|medical ethics|pharmacology|"
    r"evidence.?based medicine|electronic health records|emergency care|"
    r"anatomy|physiology|differential diagnosis|"
    # Domain: Education
    r"lesson planning|classroom management|curriculum development|"
    r"student assessment|differentiated instruction|"
    # Soft skills
    r"communication|problem solving|critical thinking|leadership|teamwork|"
    r"project management|stakeholder management|time management|"
    r"presentation skills|negotiation|"
    # Certifications
    r"aws certified|pmp|cissp|ceh|ccna|cfa|"
    # MLOps / Data Eng
    r"mlops|kubeflow|mlflow|"
    r"model serving|model deployment|"
    # Misc tools
    r"excel|google analytics|seo|sem|"
    r"salesforce|"
    r"rabbitmq|celery|"
    r"embeddings|vector database|rag|fine.?tuning|prompt engineering"
    r")\b",
    re.IGNORECASE,
)

# Domain-specific patterns (non-tech roles)
_DOMAIN_RE = re.compile(
    r"\b("
    r"autocad|solidworks|catia|ansys|simulink|primavera|ms project|"
    r"sap|oracle erp|tally prime|quickbooks|zoho|"
    r"food safety|haccp|menu planning|"
    r"legal research|legal drafting|contract law|litigation|"
    r"recruitment|employee onboarding|payroll|performance appraisal|"
    r"labour law|industrial relations|"
    r"brand strategy|content marketing|email marketing|social media marketing|"
    r"market research|competitive analysis|"
    r"supply chain management|inventory management|procurement|logistics|"
    r"quality control|six sigma|lean manufacturing|"
    r"patient care|wound care|iv therapy|medication administration|"
    r"structural analysis|surveying|building codes|"
    r"thermodynamics|fluid mechanics|solid mechanics|manufacturing processes|"
    r"circuit design|pcb design|vlsi|power systems|control systems|"
    r"pedagogy|assessment design|special needs education|"
    r"research methodology|academic writing|grant writing|"
    r"oral surgery|endodontics|periodontics|orthodontics|"
    r"pharmacovigilance|drug interactions|clinical trials|regulatory affairs"
    r")\b",
    re.IGNORECASE,
)


def _clean_skill(s: str) -> str:
    """Normalize and clean a skill string."""
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^[\-•·▪►→,;:\(\)\[\]\"\']+|[\-•·▪►→,;:\(\)\[\]\"\']+$", "", s).strip()
    return s


def _is_valid_skill(s: str) -> bool:
    """Filter noise phrases and keep valid skills."""
    if not s or len(s) < _MIN_SKILL_LEN or len(s) > _MAX_SKILL_LEN:
        return False
    sl = s.lower().strip()
    
    # Strictly reject if it contains parenthesis, ampersand, or numbers with spaces (like "5) volunteer")
    if re.search(r"[&()\[\]\{\}<>\?;:!]", sl):
        return False
        
    # Direct stop phrase match
    if sl in _STOP_PHRASES:
        return False
    
    # ── Strict immediate reject for highly toxic noise words ──
    strict_bans = {
        "engineer", "manager", "developer", "senior", "junior", "lead",
        "scoutit", "wipro", "tcs", "cognizant", "infosys", "fedex", "telekom",
        "policy", "privacy", "cookie", "agreement", "terms", "rights", "copyright",
        "applicant", "early", "hiring", "jobs", "job", "apply", "actively", "urgently",
        "division", "maharashtra", "karnataka", "india", "remote", "hybrid",
        "months", "years", "hours", "weeks", "today", "yesterday", "ago",
        "staff", "intern", "trainee", "executive", "coordinator", "officer",
        "client", "customer", "project", "product", "salary", "benefits",
        "linkedin", "guidelines", "controls", "join", "agree", "volunteer", 
        "level", "mid-senior", "guest", "language", "done", "app", "group", "dhl",
        "andhra", "pradesh", "company", "clear", "ebay", "srinsoft", "hurdles",
        "crossing", "inc", "ltd", "pvt", "limited", "naukri", "indeed", "shine"
    }
    
    words = sl.split()
    for w in words:
        if w in strict_bans:
            return False

    # Check if phrase contains ANY stop phrase as a substring
    for sp in _STOP_PHRASES:
        if len(sp) > 4 and sp in sl and sp != sl:
            # Only reject if the stop phrase is a significant portion
            if len(sp) / len(sl) > 0.5:
                return False
    # Must contain at least one letter
    if not re.search(r"[a-zA-Z]", s):
        return False
    # Skip pure numbers / dates
    if re.match(r"^[\d\s\-/\.]+$", s):
        return False
    # Skip very long single words (probably not a skill)
    if len(s) > 25 and " " not in s:
        return False
    # For multi-word phrases: at least one word must NOT be a stop word
    words = sl.split()
    if len(words) >= 2:
        non_stop = [w for w in words if w not in _STOP_WORDS and len(w) > 1]
        if len(non_stop) < 1:
            return False
        # Reject if all non-stop words are too short (< 3 chars)
        if all(len(w) < 3 for w in non_stop):
            return False
    elif len(words) == 1:
        # Single words: must not be a stop word
        if sl in _STOP_WORDS:
            return False
        # Single words must be at least 2 chars
        if len(sl) < 2:
            return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
#  Method 1: spaCy NER + noun-phrase extraction
# ─────────────────────────────────────────────────────────────────────────────
def _extract_with_spacy(text: str, max_skills: int = 60) -> Dict[str, int]:
    """Use spaCy NER and noun chunks to discover skill-like entities."""
    nlp = _load_spacy()
    if nlp is None:
        return {}

    MAX_CHARS = 100_000
    text = text[:MAX_CHARS]

    freq: Dict[str, int] = {}
    doc = nlp(text)

    # NER-based: look for ORG, PRODUCT, WORK_OF_ART (often tools/frameworks)
    relevant_labels = {"ORG", "PRODUCT", "WORK_OF_ART"}
    for ent in doc.ents:
        if ent.label_ in relevant_labels:
            skill = _clean_skill(ent.text)
            if _is_valid_skill(skill):
                key = skill.lower()
                freq[key] = freq.get(key, 0) + 1

    # Noun-chunk based: extract multi-word noun phrases that look technical
    for chunk in doc.noun_chunks:
        phrase = _clean_skill(chunk.text)
        words = phrase.split()
        # Only keep 2-4 word noun phrases
        if len(words) < 2 or len(words) > 4:
            continue
        if not _is_valid_skill(phrase):
            continue
        key = phrase.lower()
        # Extra validation: at least one word should look "technical"
        # (has a capital letter mid-word, or is a known tech word, etc.)
        has_tech_signal = (
            any(c.isupper() for c in phrase[1:]) or
            any(w.lower() in {"api", "sdk", "ml", "ai", "ui", "ux", "db"} for w in words) or
            any("." in w or "+" in w or "#" in w for w in words)
        )
        if has_tech_signal:
            freq[key] = freq.get(key, 0) + 1

    return dict(sorted(freq.items(), key=lambda x: x[1], reverse=True)[:max_skills])


# ─────────────────────────────────────────────────────────────────────────────
#  Method 2: Regex-based extraction (baseline, catches known terms)
# ─────────────────────────────────────────────────────────────────────────────
def _extract_with_regex(text: str) -> Dict[str, int]:
    """Regex baseline extraction for well-known tech/domain skills."""
    freq: Dict[str, int] = {}
    for pattern in [_TECH_RE, _DOMAIN_RE]:
        for match in pattern.findall(text):
            key = _clean_skill(match).lower()
            if _is_valid_skill(key):
                freq[key] = freq.get(key, 0) + 1
    return freq


# ─────────────────────────────────────────────────────────────────────────────
#  Method 3: N-gram frequency analysis (discovers unknown multi-word skills)
# ─────────────────────────────────────────────────────────────────────────────
def _extract_ngrams(text: str, min_count: int = 4, max_n: int = 3) -> Dict[str, int]:
    """Extract frequently occurring 2-3 word phrases as potential skills."""
    words = re.findall(r"[a-zA-Z][a-zA-Z\+\#\.]{1,25}", text.lower())
    freq: Dict[str, int] = {}

    for n in range(2, max_n + 1):
        for i in range(len(words) - n + 1):
            gram_words = words[i:i+n]
            # Quick pre-filter: skip if all words are stop words
            if all(w in _STOP_WORDS for w in gram_words):
                continue
            ngram = " ".join(gram_words)
            if _is_valid_skill(ngram):
                freq[ngram] = freq.get(ngram, 0) + 1

    # Only keep n-grams appearing frequently (higher bar = less noise)
    return {k: v for k, v in freq.items() if v >= min_count}


# ─────────────────────────────────────────────────────────────────────────────
#  Main extraction pipeline
# ─────────────────────────────────────────────────────────────────────────────
def extract_skills_from_text(
    text: str,
    top_n: int = 30,
    min_frequency: int = 1,
) -> Dict[str, int]:
    """
    Extract skills from job description text using all available methods.

    Returns: {skill_name: frequency} sorted by frequency desc.
    """
    if not text or len(text.strip()) < 50:
        return {}

    # ── Run all extractors ────────────────────────────────────────────────────
    regex_skills = _extract_with_regex(text)
    spacy_skills = _extract_with_spacy(text)
    ngram_skills = _extract_ngrams(text, min_count=3)

    # ── Merge with priority: regex > spacy > ngrams ───────────────────────────
    merged: Dict[str, int] = {}

    # Regex gets 3x boost (these are confirmed skill names)
    for skill, count in regex_skills.items():
        merged[skill] = merged.get(skill, 0) + count * 3

    # spaCy NER gets 2x boost
    for skill, count in spacy_skills.items():
        merged[skill] = merged.get(skill, 0) + count * 2

    # N-grams get 1x (need high frequency to rank)
    for skill, count in ngram_skills.items():
        merged[skill] = merged.get(skill, 0) + count

    # ── Filter and sort ───────────────────────────────────────────────────────
    filtered = {
        k: v for k, v in merged.items()
        if v >= min_frequency and _is_valid_skill(k)
    }

    sorted_skills = dict(
        sorted(filtered.items(), key=lambda x: x[1], reverse=True)[:top_n]
    )

    print(f"[SkillExtractor] Extracted {len(sorted_skills)} skills "
          f"(regex={len(regex_skills)}, spacy={len(spacy_skills)}, ngrams={len(ngram_skills)})",
          file=sys.stderr)

    return sorted_skills


# ─────────────────────────────────────────────────────────────────────────────
#  Semantic embedding for skill matching
# ─────────────────────────────────────────────────────────────────────────────
def get_skill_embeddings(skills: List[str]):
    """
    Get dense embeddings for skill strings.
    Uses sentence-transformers if available, else TF-IDF fallback.

    Returns: numpy array of shape (len(skills), embedding_dim)
    """
    import numpy as np

    if not skills:
        return np.zeros((0, 1), dtype=np.float32)

    model = get_sentence_model()
    if model is not None:
        try:
            embeddings = model.encode(skills, convert_to_numpy=True, show_progress_bar=False)
            return embeddings.astype(np.float32)
        except Exception as e:
            print(f"[SkillExtractor] Sentence-transformer encode failed: {e}", file=sys.stderr)

    # Fallback: TF-IDF
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
        mat = vec.fit_transform(skills)
        return mat.toarray().astype(np.float32)
    except Exception as e:
        print(f"[SkillExtractor] TF-IDF fallback failed: {e}", file=sys.stderr)
        return np.zeros((len(skills), 1), dtype=np.float32)


def semantic_skill_match(
    user_skills: List[str],
    required_skills: List[str],
    threshold: float = 0.55,
) -> Tuple[List[str], List[str], float]:
    """
    Semantic matching: user skill 'covers' a required skill if cosine
    similarity >= threshold.

    Returns: (matched_skills, missing_skills, match_percentage)
    """
    import numpy as np

    if not user_skills or not required_skills:
        return [], list(required_skills), 0.0

    # Get embeddings for both sets
    all_texts = user_skills + required_skills
    embeddings = get_skill_embeddings(all_texts)

    if embeddings.shape[0] < len(all_texts) or embeddings.shape[1] == 0:
        # Embedding failed — exact string fallback
        user_lower = {s.lower() for s in user_skills}
        matched = [s for s in required_skills if s.lower() in user_lower]
        missing = [s for s in required_skills if s.lower() not in user_lower]
        score = len(matched) / max(len(required_skills), 1) * 100
        return matched, missing, score

    user_emb = embeddings[:len(user_skills)]
    req_emb = embeddings[len(user_skills):]

    # Cosine similarity
    norm_u = np.linalg.norm(user_emb, axis=1, keepdims=True) + 1e-9
    norm_r = np.linalg.norm(req_emb, axis=1, keepdims=True) + 1e-9
    sim = (req_emb / norm_r) @ (user_emb / norm_u).T  # (n_req, n_user)
    best_match = sim.max(axis=1)

    # Classify as matched or missing
    matched = []
    missing = []
    user_lower = {s.lower() for s in user_skills}

    for i, (req, score) in enumerate(zip(required_skills, best_match)):
        # Match if: semantic similarity high OR string containment
        if score >= threshold or any(req.lower() in us or us in req.lower() for us in user_lower):
            matched.append(req)
        else:
            missing.append(req)

    overall = (len(matched) / len(required_skills)) * 100
    return matched, missing, overall


# ─────────────────────────────────────────────────────────────────────────────
#  CLI test
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    sample_text = """
    We are looking for a Software Engineer with 3+ years of experience in Python,
    JavaScript, React, Node.js, and SQL. Knowledge of Docker, Kubernetes, and AWS
    is a plus. The candidate should have strong problem solving skills and experience
    with agile methodologies. Experience with machine learning and TensorFlow is
    preferred. Must be proficient in data structures and algorithms.
    Good communication skills required. Experience with Git, CI/CD pipelines,
    and microservices architecture. Knowledge of system design principles.
    """
    skills = extract_skills_from_text(sample_text)
    print(json.dumps(skills, indent=2))
