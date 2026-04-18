# Career Roadmap Fix - O*NET + Webscraping Hybrid for Any Role
Track progress for O*NET primary → live webscraping jobs/fallback skills (stable & dynamic).

## TODO Steps (0/6 complete)

### [✅] 1. Create CLI wrapper
\`backend/ml/skill_scraper_cli.py\` - Wraps skill_resources_scraper.get_dynamic_role_resources(role) → JSON stdout for Node spawn.

### [✅] 2. Fix backend/routes/career.js
Dynamic Python ML spawn → live webscraping roadmap.

### [ ] 3. Install Python deps
cd backend/ml && pip install -r requirements.txt

### [ ] 2. Fix backend/routes/career.js
Replace generateDynamicRoadmap() → spawn python skill_scraper_cli.py "\$role" → parse phases → frontend shape.

### [ ] 3. Install Python deps
cd backend/ml && pip install -r requirements.txt

### [ ] 4. Test subprocess locally
node -e "require('./backend/services/careerScraper').getRoleSkills('Quantum Engineer')"

### [ ] 5. Test full endpoint
curl "http://localhost:5000/api/career/personalized?role=Quantum%20Engineer" → verify Qiskit phases

### [ ] 6. Verify frontend
Load /career → select Quantum Engineer → see scraped phases + resources

## Progress Log

- Step 1 created TODO.md ✅
