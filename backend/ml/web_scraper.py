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


class JobScraper:
    def __init__(self):
        self._scraper = RealJobScraper()

    def scrape_job_skills(
        self,
        job_title: str,
        location: str = "India",
        num_jobs: int = 5,
    ) -> List[str]:
        """Return a ranked list of skill strings extracted from live job postings."""
        return self._scraper.scrape_job_skills(job_title, location, num_jobs)

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
        return self._scraper.get_live_jobs(job_title, location, num_each)


# ── smoke-test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    scraper = JobScraper()

    print("=== Skills ===")
    skills = scraper.scrape_job_skills("Quantum Engineer")
    print(json.dumps({"skills": skills}, indent=2))

    print("\n=== Live Jobs ===")
    jobs = scraper.get_live_jobs("Quantum Engineer")
    print(json.dumps(jobs, indent=2))