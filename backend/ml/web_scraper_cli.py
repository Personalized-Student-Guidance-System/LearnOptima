#!/usr/bin/env python3
"""
CLI wrapper for web_scraper.py - called from Node.js child_process.spawn
Usage: python web_scraper_cli.py scrape_job_skills
Reads JSON from stdin: {"job_title": "Doctor", "location": "India", "num_jobs": 20}
"""

import sys
import json
import contextlib
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

# Ensure imports resolve when called from Node child_process
sys.path.insert(0, str(SCRIPT_DIR))

from web_scraper import JobScraper

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command"}), file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]

    try:
        raw = sys.stdin.read().strip() or "{}"
        input_data = json.loads(raw)
        job_title = input_data.get("job_title", "Software Engineer")
        location = input_data.get("location", "India")

        # IMPORTANT: write only JSON to stdout; send scraper logs to stderr
        with contextlib.redirect_stdout(sys.stderr):
            scraper = JobScraper()

            if command == "scrape_job_skills":
                num_jobs = int(input_data.get("num_jobs", 20))
                skills = scraper.scrape_job_skills(job_title, location, num_jobs)
                payload = {"skills": skills}
            elif command == "get_live_jobs":
                num_each = int(input_data.get("num_each", 10))
                jobs = scraper.get_live_jobs(job_title, location, num_each)
                # Keep a consistent payload shape for Node consumers
                payload = {"jobs": jobs}
            else:
                print(json.dumps({"error": f"Unknown command: {command}"}), file=sys.stderr)
                sys.exit(1)

        print(json.dumps(payload, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
