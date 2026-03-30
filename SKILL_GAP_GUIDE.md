# Study Hours & Skill Gap Analysis - Complete Guide

## 📊 Study Hours Calculation (Dashboard)

### How It Works

The study hours displayed in the dashboard are **calculated from your actual planner tasks**:

```javascript
// For each day of the current week:
const dayTasks = tasks.filter(t => new Date(t.date).toDateString() === day.toDateString());

// Sum up the duration field from all tasks
const h = dayTasks.reduce((sum, t) => sum + (t.duration || 1), 0) || 0;

// If no tasks, fallback to random hours (1-4) for visualization
const hours = h > 0 ? h : Math.floor(Math.random() * 4 + 1);
```

### Key Points

- **Real Data**: Hours are pulled directly from your Planner tasks
- **Task Duration**: Uses the `duration` field from each task (in hours)
- **Default**: If a task has no duration set, it defaults to 1 hour
- **Weekly Aggregation**: Shows 7 days (Monday-Sunday) in bar chart format
- **Total Calculation**: Sums all daily hours for the week total
- **Fallback**: If no planner data exists, uses random values for UI testing

### Example

If you have:
- Monday: 2 tasks (1.5h + 2h) = 3.5h
- Tuesday: 1 task (3h) = 3h
- Wednesday: 0 tasks = 1h (random)
- ...and so on

The dashboard will display actual bars for Mon-Tue and estimated for Wed+

---

## 🧠 ML-Powered Skill Gap Analyzer

### Features

#### 1. **Data-Driven Analysis**
- **Real User Data**: Uses your profile skills, resume, and target role
- **ML Scoring**: Analyzes gaps using:
  - Importance weighting (critical skills get higher priority)
  - Job market demand (how often skill appears in job descriptions)
  - Time-to-proficiency estimation
  - Prerequisite skill analysis

#### 2. **Brief Overview Card**
Shows at a glance:
- Match score (0-100%) with dynamic color coding
- Number of matched skills (✓ Your Strengths)
- Number of missing skills (✗ Areas to Focus)
- AI-generated analysis text explaining your current level

#### 3. **Expandable Detailed Breakdown**
Click "Detailed Gap Breakdown" to see:
- **Your Strengths**: All skills you already have
- **Areas to Focus**: Skills you need with urgency badges (Critical/High/Medium)
- Click any missing skill to add to "Learning Queue"

#### 4. **Skills to Learn Queue**
Custom learning list where you can:
- Add skills you want to prioritize
- Remove skills when ready
- Add custom skills via input field
- Queue persists in your profile

#### 5. **Priority Ranking System**

Each missing skill gets scored on:

```
Priority Score = (Importance × 0.4) + (Job Demand × 0.3) + 
                 (Prerequisites Met × 0.2) + (Time Efficiency × 0.1)
```

**Urgency Levels:**
- **Critical** (80-100): Must-have core skills
- **High** (60-79): Very important, frequently tested
- **Medium** (40-59): Good to have, enhances profile

#### 6. **Learning Path Timeline**
- Estimated duration for each skill
- Week-by-week breakdown
- Prerequisites for each skill
- Realistic time estimates based on skill complexity

### ML Algorithms Used

1. **TF-IDF Similarity Matching**
   - Fuzzy matching for skill name variations
   - Finds similar skills even with different naming conventions

2. **Importance Weighting**
   - Different skills have different importance scores for each role
   - Software Engineer: Data Structures (98/100), Git (85/100)
   - Data Scientist: Python (98/100), Statistics (90/100)

3. **Job Market Demand Analysis**
   - Weights based on how often skill appears in job descriptions
   - Python (98/100), JavaScript (96/100)
   - Helps prioritize marketable skills

4. **Prerequisite Graph**
   - Ensures you learn fundamentals before advanced topics
   - React requires: JavaScript, HTML, CSS
   - Deep Learning requires: Machine Learning, Neural Networks, Python

5. **Time-to-Proficiency Model**
   - Estimates learning duration based on skill complexity
   - Data Structures: 45 days
   - System Design: 60 days
   - Machine Learning: 90 days

---

## 🤖 Agentic AI Features

### AI-Powered Insights Section

#### 1. **Personalized Analysis**
- Evaluates your current skill level
- Identifies learning stage (beginner/intermediate/advanced)
- Provides contextual recommendations

#### 2. **Action Plan Generation**
4-phase plan:
- **Weeks 1-4**: Master fundamentals
- **Weeks 5-8**: Build core competencies
- **Weeks 9-16**: Apply knowledge in projects
- **Weeks 17-24**: Specialize in target areas

#### 3. **Strengths & Weaknesses**
- Identifies your current strengths
- Highlights areas needing improvement
- Provides context-aware suggestions

#### 4. **Estimated Timeline**
- Calculates total weeks needed to become job-ready
- Typically 20-30 weeks for comprehensive learning
- Adjustes based on your current skill count

#### 5. **Next Steps**
1. Complete 1-2 side projects
2. Contribute to open-source
3. Practice coding problems
4. Build portfolio and resume

---

## 🔄 How It All Works Together

### User Journey

1. **You take onboarding steps**
   - Profile: Select branch, semester, target role
   - Resume: Upload for skill extraction
   - Skills: Add any additional skills
   - Results: Profile updated with extracted skills

2. **Dashboard shows study hours**
   - Based on your planner tasks
   - Real data: If you have tasks, it calculates from them
   - Mock data: If no tasks, shows estimated values

3. **Visit Skill Gap Analyzer**
   - System pulls your profile and skills
   - Runs ML analysis against target role requirements
   - Computes priority scores for missing skills
   - Generates AI recommendations

4. **Learn at your own pace**
   - Add skills to "Learning Queue"
   - Progress tracked against timeline
   - Dashboard updates as you add new skills
   - Career Roadmap shows your advancement

---

## 📈 API Endpoints (Backend)

### New Skill Analysis Endpoints

```
GET /skills/analyze
- Returns: Overview, matched skills, missing skills prioritized by ML
- Includes: Learning queue, AI insights

GET /skills/learning-path
- Returns: Week-by-week learning plan with timelines
- Includes: Estimated completion date, prerequisites

GET /skills/ai-recommendation
- Returns: Personalized analysis, action plan, next steps
- Includes: Strengths, weaknesses, estimated time to job-ready

PUT /skills/learning-queue
- Body: { skill: "React", action: "add" | "remove" }
- Updates: Your custom learning priorities
```

---

## 🛠 Technologies Used

### Frontend
- React with Hooks
- Axios for API calls
- Design tokens system (colors, spacing)
- Responsive grid layouts

### Backend
- Node.js/Express
- MongoDB with StudentProfile model
- Python ML scripts (enhanced_skill_analyzer.py)
- Scikit-learn for TF-IDF analysis

### ML Models
- **TF-IDF Vectorizer**: Text similarity matching
- **Cosine Similarity**: Skill name fuzzy matching
- **Custom Intent Ranking**: Priority score calculation
- **Prerequisite Graph**: Dependency analysis

---

## 💾 Data Stored

### StudentProfile Collection
```javascript
{
  userId: ObjectId,
  targetRole: String,                    // Your target job role
  extractedSkills: [String],             // From resume
  extraSkills: [String],                 // Manually added
  skillsToLearn: [String],               // Your learning queue
  branch: String,
  semester: Number,
  college: String,
  // ... other fields
}
```

---

## 🎯 Expected User Experience

### Before Visiting Skill Gap

✓ Onboarding complete
✓ Profile has target role
✓ Some skills documented (from resume or manual entry)

### On Skill Gap Page Load

1. See brief analysis card (score + summary)
2. Can expand "Detailed Breakdown" for full skill list
3. See top 5 priority skills with urgency badges
4. Get AI-generated insights and action plan
5. View estimated learning timeline

### Interactive Elements

- Click missing skills to add to learning queue
- Remove skills from queue with ✕ button
- Add custom skills via input field
- All changes save to database automatically

### Results

- Clear understanding of skill gaps
- Prioritized learning path
- Realistic timeline (20-30 weeks typically)
- Actionable next steps
- AI-powered personalized guidance

---

## 📝 Example Output

```
SKILL GAP ANALYSIS FOR DATA SCIENTIST

Match Score: 62/100 (Good progress!)
Matched: Python, SQL, Statistics (3 skills)
Missing: TensorFlow, PyTorch, MLOps, A/B testing (4 skills)

TOP PRIORITIES:
1. TensorFlow (Critical) - 5 weeks
2. PyTorch (High) - 5 weeks
3. MLOps Fundamentals (High) - 3 weeks
4. A/B testing (Medium) - 2 weeks
5. Deployment (Medium) - 3 weeks

AI ANALYSIS:
"You have a solid math foundation. Focus on deep learning 
frameworks and production-ready code. Total: 26 weeks."

ACTION PLAN:
Week 1-4: Master TensorFlow fundamentals
Week 5-8: Learn PyTorch and MLOps
Week 9-16: Build 2-3 end-to-end ML projects
Week 17-26: Specialize in CV or NLP
```

---

Generated: March 29, 2026
Updated features include ML-powered skill prioritization, agentic AI recommendations, and real-time user data integration.
