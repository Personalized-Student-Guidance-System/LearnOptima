"""
career_routes.py  ──  Flask blueprint for all /career/* endpoints
══════════════════════════════════════════════════════════════════

Architecture: Zero-waste Claude pipeline
  ┌──────────────────────────────────────────────────────────────┐
  │  Request → MongoDB cache check → HIT: return (0 Claude)      │
  │            MISS → static catalogue → structured scrape       │
  │            → keyword classify → static resources lookup      │
  │            → [max 2 Claude calls] → MongoDB save → return    │
  └──────────────────────────────────────────────────────────────┘

Endpoints:
  GET  /career/personalized          → roadmap phases + skill gap
  GET  /career/live-jobs             → real-time job listings
  GET  /career/checklist/:id         → user checklist state
  POST /career/checklist/item        → toggle a checklist item
  GET  /career/skill-gap             → raw skill gap analysis
  POST /career/invalidate-cache      → force-clear MongoDB cache for role
  GET  /profile                      → user profile  (app-level)
  PUT  /profile                      → update target role (app-level)
"""

from flask import Blueprint, request, jsonify
import os
import hashlib
import time
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from skill_gap_analyzer      import analyze_skill_gap
from skill_resources_scraper import SkillResourcesScraper, JobScraper, _cache as _roadmap_cache

career_bp = Blueprint("career", __name__, url_prefix="/career")

# ─────────────────────────────────────────────────────────────────────────────
#  In-memory caches for skill-gap and jobs (short TTL)
# ─────────────────────────────────────────────────────────────────────────────
_jobs_cache:      Dict[str, Dict] = {}
_checklist_store: Dict[str, Dict] = {}

_GENERIC_PLACEHOLDERS = {
    "domain fundamentals", "core tools", "applied problem solving", "industry standards",
    "professional communication", "documentation", "project execution", "compliance & ethics",
}

_scraper     = SkillResourcesScraper()
_job_scraper = JobScraper()

JOBS_TTL_SECS    = 1800   # 30 minutes
SKILLGAP_TTL_SECS = 3600  # 1 hour
_skillgap_cache: Dict[str, Dict] = {}


def _mem_cache_get(store: Dict, key: str, ttl: int) -> Optional[Dict]:
    entry = store.get(key)
    if entry and (time.time() - entry["ts"]) < ttl:
        return entry["data"]
    return None


def _mem_cache_set(store: Dict, key: str, data: Dict):
    store[key] = {"ts": time.time(), "data": data}


def _looks_generic_roadmap(data: Dict) -> bool:
    skills = [str(s).strip().lower() for s in (data or {}).get("extractedSkills", []) if s]
    if not skills:
        return True
    return all(s in _GENERIC_PLACEHOLDERS for s in skills)


# ── User profile helper ────────────────────────────────────────────────────────
_profile_store: Dict[str, Any] = {}


def _get_user_profile() -> Dict:
    base = {
        "userId":   "user_demo",
        "name":     "Demo User",
        "email":    "demo@example.com",
        "skills":   ["Python", "SQL", "React", "Docker"],
        "location": "India",
        "availableRoles": [
            "Software Engineer", "Data Scientist", "DevOps Engineer",
            "Frontend Developer", "Backend Developer", "ML Engineer",
            "Full Stack Developer", "Product Manager",
            "Quantum Engineer", "Blockchain Developer",
            "Security Engineer", "Mobile Developer",
            "Doctor", "Chartered Accountant",
        ],
    }
    base.update(_profile_store)
    return base


# ─────────────────────────────────────────────────────────────────────────────
#  Profile routes (registered at app level in create_app, NOT on blueprint)
# ─────────────────────────────────────────────────────────────────────────────
def get_profile():
    return jsonify(_get_user_profile())


def update_profile():
    body = request.get_json(force=True, silent=True) or {}
    _profile_store.update(body)
    return jsonify({"status": "ok", "updated": body})


# ─────────────────────────────────────────────────────────────────────────────
#  GET /career/personalized?role=<role>&location=<location>
# ─────────────────────────────────────────────────────────────────────────────
@career_bp.route("/personalized", methods=["GET"])
def get_personalized_roadmap():
    """
    Zero-waste Claude pipeline.
    Response shape (root-level, matches CareerRoadmap.jsx):
      {
        role, location, checklistId,
        phases: [...],
        skillGap: { ... },
        extractedSkills, source, mlPipeline,
        availableRoles, generatedAt
      }
    """
    role     = request.args.get("role", "").strip()
    location = request.args.get("location", "India").strip()

    if not role:
        return jsonify({"error": "role parameter required", "phases": []}), 400

    print(f"\n[API] /career/personalized → role='{role}' location='{location}'")

    try:
        profile     = _get_user_profile()
        user_skills = profile.get("skills", [])

        # ── 1. Build roadmap via zero-waste pipeline ─────────────────────
        # The scraper handles its own MongoDB caching internally.
        # Console logs will show [CACHE HIT] or [CACHE MISS] status.
        print(f"[API] Invoking zero-waste pipeline for '{role}'...")
        roadmap_data = _scraper.get_dynamic_role_resources(role, location)
        phases       = roadmap_data["phases"]

        print(f"[API] Pipeline source: {roadmap_data.get('source', 'unknown')}")
        print(f"[API] Pipeline: {roadmap_data.get('ml_pipeline', '')}")

        # ── 2. Validate — reject generic-only roadmaps ───────────────────
        extracted = roadmap_data.get("extracted_skills", [])
        if extracted and all(s.lower() in _GENERIC_PLACEHOLDERS for s in extracted):
            print(f"[API] ⚠ WARNING: Roadmap for '{role}' has only generic placeholder "
                  f"skills → invalidating cache and retrying")
            _roadmap_cache.invalidate(role, location)
            roadmap_data = _scraper.get_dynamic_role_resources(role, location)
            phases       = roadmap_data["phases"]

        # ── 3. Skill-gap analysis ─────────────────────────────────────────
        sg_key = f"{role.lower()}::{location.lower()}::skillgap"
        gap_data = _mem_cache_get(_skillgap_cache, sg_key, SKILLGAP_TTL_SECS)
        if gap_data:
            print(f"[API] Skill-gap cache hit for '{role}'")
        else:
            print(f"[API] Running skill-gap analysis for '{role}'...")
            gap_data = analyze_skill_gap(user_skills, role, location)
            _mem_cache_set(_skillgap_cache, sg_key, gap_data)

        # ── 4. Annotate each phase resource with 'hasSkill' flag ─────────
        user_skill_set = {s.lower() for s in user_skills}
        matched_set    = {s.lower() for s in gap_data.get("matched_skills", [])}

        for phase in phases:
            for res in phase.get("resources", []):
                skill_key      = res.get("skill", "").lower()
                res["hasSkill"] = (skill_key in user_skill_set or
                                   skill_key in matched_set)

        # ── 5. Stable checklist ID ────────────────────────────────────────
        checklist_id = hashlib.md5(
            f"{profile['userId']}::{role.lower()}".encode()
        ).hexdigest()

        response = {
            "role":            role,
            "location":        location,
            "checklistId":     checklist_id,
            "phases":          phases,
            "extractedSkills": roadmap_data["extracted_skills"],
            "source":          roadmap_data["source"],
            "mlPipeline":      roadmap_data.get("ml_pipeline", ""),
            "skillGap": {
                "matchScore":      gap_data["match_score"],
                "matchedSkills":   gap_data["matched_skills"],
                "missingSkills":   gap_data["missing_skills"],
                "highPriority":    gap_data["high_priority_gaps"],
                "mediumPriority":  gap_data["medium_priority_gaps"],
                "estimatedWeeks":  gap_data.get("estimated_weeks", 24),
                "keyInsight":      gap_data.get("key_insight", ""),
                "learningOrder":   gap_data.get("learning_order", []),
            },
            "availableRoles":  profile["availableRoles"],
            "generatedAt":     datetime.utcnow().isoformat() + "Z",
        }

        print(f"[API] ✓ /personalized response ready for '{role}' "
              f"({len(phases)} phases, {len(roadmap_data['extracted_skills'])} skills)")
        return jsonify(response)

    except Exception as exc:
        import traceback
        print(f"[API] ✗ /personalized error for '{role}': {exc}")
        traceback.print_exc()
        return jsonify({"error": str(exc), "phases": []}), 500


# ─────────────────────────────────────────────────────────────────────────────
#  GET /career/live-jobs?role=<role>&location=<location>&limit=<n>
# ─────────────────────────────────────────────────────────────────────────────
@career_bp.route("/live-jobs", methods=["GET"])
def get_live_jobs():
    """Structured scrape + Claude supplement live job listings."""
    role     = request.args.get("role", "").strip()
    location = request.args.get("location", "India").strip()
    limit    = int(request.args.get("limit", 10))

    if not role:
        return jsonify({"jobs": []}), 400

    cache_key = f"{role.lower()}::{location.lower()}::jobs"
    cached    = _mem_cache_get(_jobs_cache, cache_key, JOBS_TTL_SECS)
    if cached:
        print(f"[API] Jobs cache hit for '{role}'")
        return jsonify(cached)

    try:
        print(f"[API] Scraping live jobs for '{role}' in '{location}'...")
        jobs = _job_scraper.scrape_live_jobs(role, location, limit=limit)
        jobs.sort(key=lambda j: j.get("deadline") or "9999")

        response = {
            "role":      role,
            "location":  location,
            "jobs":      jobs,
            "count":     len(jobs),
            "source":    "naukri+linkedin+claude",
            "fetchedAt": datetime.utcnow().isoformat() + "Z",
        }
        _mem_cache_set(_jobs_cache, cache_key, response)
        print(f"[API] ✓ Returning {len(jobs)} jobs for '{role}'")
        return jsonify(response)

    except Exception as exc:
        print(f"[API] ✗ /live-jobs error: {exc}")
        return jsonify({"jobs": [], "error": str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
#  GET /career/skill-gap?role=<role>&location=<location>
# ─────────────────────────────────────────────────────────────────────────────
@career_bp.route("/skill-gap", methods=["GET"])
def get_skill_gap():
    """Raw ML skill-gap analysis."""
    role     = request.args.get("role", "").strip()
    location = request.args.get("location", "India").strip()

    if not role:
        return jsonify({"error": "role required"}), 400

    profile     = _get_user_profile()
    user_skills = profile.get("skills", [])

    try:
        print(f"[API] Skill-gap analysis for '{role}'...")
        result = analyze_skill_gap(user_skills, role, location)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
#  POST /career/invalidate-cache
#  Body: { "role": "...", "location": "..." }
#  Forces the MongoDB roadmap cache to be cleared for the given role,
#  so the next /personalized request will regenerate fresh data.
# ─────────────────────────────────────────────────────────────────────────────
@career_bp.route("/invalidate-cache", methods=["POST"])
def invalidate_cache():
    """Force-clear MongoDB roadmap cache for a specific role."""
    body     = request.get_json(force=True, silent=True) or {}
    role     = body.get("role", "").strip()
    location = body.get("location", "India").strip()

    if not role:
        return jsonify({"error": "role required"}), 400

    _roadmap_cache.invalidate(role, location)
    print(f"[API] Cache invalidated for '{role}' in '{location}'")
    return jsonify({
        "status":   "ok",
        "message":  f"Cache cleared for '{role}' — next request will regenerate",
        "role":     role,
        "location": location,
    })


# ─────────────────────────────────────────────────────────────────────────────
#  GET /career/checklist/<checklist_id>
# ─────────────────────────────────────────────────────────────────────────────
@career_bp.route("/checklist/<checklist_id>", methods=["GET"])
def get_checklist(checklist_id):
    data = _checklist_store.get(checklist_id, {"items": {}})
    return jsonify(data)


# ─────────────────────────────────────────────────────────────────────────────
#  POST /career/checklist/item
# ─────────────────────────────────────────────────────────────────────────────
@career_bp.route("/checklist/item", methods=["POST"])
def toggle_checklist_item():
    body       = request.get_json(force=True, silent=True) or {}
    role       = body.get("role", "")
    item_key   = body.get("itemKey", "")
    is_checked = bool(body.get("isChecked", False))

    profile      = _get_user_profile()
    checklist_id = hashlib.md5(
        f"{profile['userId']}::{role.lower()}".encode()
    ).hexdigest()

    if checklist_id not in _checklist_store:
        _checklist_store[checklist_id] = {"items": {}}

    _checklist_store[checklist_id]["items"][item_key] = is_checked
    return jsonify({"status": "ok", "itemKey": item_key, "isChecked": is_checked})


# ─────────────────────────────────────────────────────────────────────────────
#  App factory
# ─────────────────────────────────────────────────────────────────────────────
def create_app():
    from flask import Flask
    from flask_cors import CORS

    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # /profile registered ONLY at app level (not on blueprint) to avoid conflicts
    app.add_url_rule("/profile", "get_profile",    get_profile,    methods=["GET"])
    app.add_url_rule("/profile", "update_profile", update_profile, methods=["PUT"])

    app.register_blueprint(career_bp)
    return app


if __name__ == "__main__":
    app  = create_app()
    port = int(os.environ.get("PORT", 5000))
    print(f"\n[Server] Starting on http://0.0.0.0:{port}")
    print(f"[Server] Zero-waste Claude architecture active")
    print(f"[Server] MongoDB roadmap cache: {'active' if _roadmap_cache._connected else 'in-memory fallback'}")
    app.run(host="0.0.0.0", port=port, debug=True)
