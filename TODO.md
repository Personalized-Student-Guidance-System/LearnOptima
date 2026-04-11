# Fix Skill Scraper CLI - Anthropic Crash & Resource Links

Current Status: ✅ Plan approved

## Implementation Steps:

### Step 1: Update dependencies [PENDING]
```
backend/ml/requirements.txt:
- anthropic==0.39.0 → anthropic==0.33.1
+ httpx==0.27.0 (stable combo)
```
Command: `cd backend/ml && pip install -r requirements.txt --upgrade`

### Step 2: Fix client in skill_resources_scraper.py [PENDING]
```
backend/ml/skill_resources_scraper.py:
_client = anthropic.Anthropic(api_key=key)
→ _client = anthropic.Anthropic(api_key=key, timeout=30.0)
```

### Step 3: Fix client in skill_gap_analyzer.py [PENDING]
```
backend/ml/skill_gap_analyzer.py:
_anthropic_client = anthropic.Anthropic(api_key=api_key)
→ _anthropic_client = anthropic.Anthropic(api_key=api_key, timeout=30.0)
```

### Step 4: Install & Test [PENDING]
```
cd backend/ml
pip install -r requirements.txt --upgrade
python skill_scraper_cli.py "Software Engineer" "India"
```
Expect JSON with "phases" → "resources" → [{"title": "...", "url": "..."}]

### Step 5: Backend Verification [PENDING]
- Check backend/routes/career.js spawns CLI correctly
- Restart server
- Test /api/career/roadmap → returns data with URLs

### Step 6: Frontend [PENDING]
- CareerRoadmap.jsx → PhaseCard.jsx renders links

### Completed Steps:
```

