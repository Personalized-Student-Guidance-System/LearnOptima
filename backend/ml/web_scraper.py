"""
web_scraper.py
~~~~~~~~~~~~~~
Thin stable interface over RealJobScraper.
The rest of the codebase (skill_resources_scraper, API routes) imports ONLY this file,
keeping them decoupled from the Selenium implementation details.

Exposes:
  JobScraper.scrape_job_skills(job_title, location, num_jobs)  → List[str]
  JobScraper.get_live_jobs(job_title, location, num_each)       → List[Dict]
"""

import json
from typing import Dict, List

from real_job_scraper import RealJobScraper
from skill_resources_scraper import JobScraper as RequestsJobScraper


class JobScraper:
    def __init__(self):
        self._scraper = None
        self._fallback_scraper = RequestsJobScraper()
        self._init_error = None

        try:
            self._scraper = RealJobScraper()
        except Exception as exc:
            self._init_error = str(exc)
            print(f"[web_scraper] RealJobScraper unavailable, using fallback scraper: {exc}")

    def scrape_job_skills(
        self,
        job_title: str,
        location: str = "India",
        num_jobs: int = 5,
    ) -> List[str]:
        """Return a ranked list of skill strings extracted from live job postings."""
        if self._scraper is not None:
            try:
                return self._scraper.scrape_job_skills(job_title, location, num_jobs)
            except Exception as exc:
                print(f"[web_scraper] Selenium skill scrape failed, using fallback: {exc}")

        return self._fallback_scraper.scrape_job_skills(job_title, location, num_jobs)

    def get_live_jobs(
        self,
        job_title: str,
        location: str = "India",
        num_each: int = 5,
    ) -> List[Dict]:
        """
        Return structured job dicts from Naukri + LinkedIn, each with:
          title, company, location, applyUrl (direct job page), source, deadline
        """
        if self._scraper is not None:
            try:
                return self._scraper.get_live_jobs(job_title, location, num_each)
            except Exception as exc:
                print(f"[web_scraper] Selenium live-jobs scrape failed, using fallback: {exc}")

        fallback_jobs = self._fallback_scraper.scrape_live_jobs(job_title, location, num_each)
        normalized = []
        for job in fallback_jobs:
            # Normalize shape and remove "N/A" deadline strings
            deadline = job.get("deadline")
            if isinstance(deadline, str) and deadline.strip().upper() in {"N/A", "NA", "NONE", "NULL", ""}:
                deadline = None

            normalized.append({
                "title": job.get("title", job_title),
                "company": job.get("company", ""),
                "location": job.get("location", location),
                "applyUrl": job.get("applyUrl", job.get("url", "")),
                "source": job.get("source", "fallback"),
                "deadline": deadline,
            })

        # Filter out entries without a usable applyUrl
        normalized = [j for j in normalized if isinstance(j.get("applyUrl"), str) and j["applyUrl"].startswith("http")]
        return normalized


# ── smoke-test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    scraper = JobScraper()

    print("=== Skills ===")
    skills = scraper.scrape_job_skills("Quantum Engineer")
    print(json.dumps({"skills": skills}, indent=2))

    print("\n=== Live Jobs ===")
    jobs = scraper.get_live_jobs("Quantum Engineer")
    print(json.dumps(jobs, indent=2))