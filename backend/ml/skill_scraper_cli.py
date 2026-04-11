#!/usr/bin/env python3
"""
CLI wrapper for dynamic webscraping roadmap.
Usage: python backend/ml/skill_scraper_cli.py "Quantum Engineer" "India"
Scrapes live jobs → Claude extracts skills → tiered resources → JSON roadmap
"""

import sys
import json
import contextlib
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Add backend/ml to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))
from skill_resources_scraper import SkillResourcesScraper

def main():
    if len(sys.argv) < 2:
        role = "Software Engineer"
        location = "India"
    else:
        role = sys.argv[1]
        location = sys.argv[2] if len(sys.argv) > 2 else "India"
    
    print(f"[CLI] Scraping roadmap for role='{role}', location='{location}'", file=sys.stderr)
    
    scraper = SkillResourcesScraper()
    # Redirect internal scraper logs to stderr so stdout stays valid JSON
    with contextlib.redirect_stdout(sys.stderr):
        result = scraper.get_dynamic_role_resources(role, location)
    
    # Print JSON (stdout for Node.js child_process)
    print(json.dumps(result, ensure_ascii=True, indent=None))
    
    print(f"[CLI] Generated {len(result.get('phases', []))} phases with {len(result.get('extracted_skills', []))} skills", file=sys.stderr)

if __name__ == "__main__":
    main()



