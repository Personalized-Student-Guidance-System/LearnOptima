<<<<<<< HEAD
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
=======
# OCR Gradesheet Extraction Fix - UPDATED ✅

## Completed Steps:
- [x] 1. Created TODO.md
- [x] 2. Edited LearnOptima/backend/ml/ocr_parser.py: Added DEBUG prints (raw_text, lines, matches), robust 6-pattern line-by-line extraction (Name Grade Credits, Name Credits Grade, etc.), expanded grades (A-/B-/DIST/PASS), dedupe, max 12 subs, returns debug_lines + ocr_count


- [ ] 4. Start backend if needed: `cd LearnOptima/backend && npm start`
- [ ] 5. Frontend test: `cd LearnOptima/frontend && npm run dev`, login → Academics → Upload clear gradesheet image
- [ ] 6. Verify extraction works (check ML console DEBUG MATCH lines)
>>>>>>> origin/maithili

Next: Run step 3-5 commands. Upload image to test - should now extract even if format varies.
