"""
career_routes.py  (Flask blueprint — adapt for FastAPI/Express as needed)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Fixes:
  /career/live-jobs  now returns jobs with direct applyUrl (not search page URL).
  /career/personalized  uses AI fallback when scraping yields < 3 skills.
"""

from flask import Blueprint, request, jsonify
from web_scraper import JobScraper
from skill_resources_scraper import SkillResourcesScraper

career_bp = Blueprint("career", __name__, url_prefix="/career")

_job_scraper      = JobScraper()
_skill_scraper    = SkillResourcesScraper()


# ── GET /career/live-jobs?role=Quantum+Engineer&location=India ────────────────
@career_bp.route("/live-jobs")
def live_jobs():
    role     = request.args.get("role", "Software Engineer").strip()
    location = request.args.get("location", "India").strip()
    num      = int(request.args.get("num", 5))

    # get_live_jobs returns jobs with verified direct applyUrl
    jobs = _job_scraper.get_live_jobs(role, location, num_each=num)

    return jsonify({"role": role, "jobs": jobs})


# ── GET /career/personalized?role=Quantum+Engineer ───────────────────────────
@career_bp.route("/personalized")
def personalized():
    role     = request.args.get("role", "Software Engineer").strip()
    location = request.args.get("location", "India").strip()

    # SkillResourcesScraper handles scrape → AI fallback → static fallback
    result = _skill_scraper.get_dynamic_role_resources(role, location, num_jobs=5)

    return jsonify({
        "role":           result["role"],
        "phases":         result["phases"],
        "availableRoles": [],         # populated by /profile
        "source":         result.get("source", ""),
    })