# Career Roadmap - Database & Web Scraping Flow

## MongoDB Collections Overview

### 1. **StudentProfile Collection** ✅ (PRIMARY - Target Role Source)
**Location**: `backend/models/StudentProfile.js`

**Fields Used for Career Roadmap**:
```javascript
{
  _id: ObjectId,
  userId: ObjectId,          // Reference to User
  
  // TARGET ROLE (FETCHED FOR ROADMAP)
  targetRole: String,        // e.g., "Software Engineer", "Data Scientist"
  
  // SKILL REPRESENTATION (EXTRACTED FROM RESUME)
  extractedSkills: [String], // ["Python", "JavaScript", "React", ...]
  extractedEducation: [String],
  extractedExperience: [String],
  extractedCertifications: [String],
  extraSkills: [String],     // User manually added skills
  
  // OTHER FIELDS
  branch: String,
  semester: Number,
  cgpa: Number,
  college: String,
  resumeUrl: String,
  syllabusUrl: String,
  timetable: Object,
  createdAt: Date,
  updatedAt: Date
}
```

**Query Used in career.js**:
```javascript
const profile = await StudentProfile.findOne({ userId });
// Retrieves:
// - profile.targetRole  → Use for selecting roadmap template
// - profile.extractedSkills  → Compare with roadmap skills to identify gaps
```

---

### 2. **RoadmapChecklist Collection** ✅ (SECONDARY - Track Progress)
**Location**: Created dynamically in `backend/routes/career.js`

**Schema**:
```javascript
const checklistSchema = new mongoose.Schema({
  userId: ObjectId,          // Reference to User
  role: String,              // "Software Engineer", "Data Scientist", etc.
  items: Map<String, Boolean>, // Track which tasks are completed
                             // { "Foundation-Python": true, "Foundation-DSA": false, ... }
  createdAt: Date,
  updatedAt: Date
});

// Collection name: 'RoadmapChecklist'
```

**Sample Document**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "userId": ObjectId("507f1f77bcf86cd799439012"),
  "role": "Software Engineer",
  "items": {
    "Foundation-Learn C/C++ basics": true,
    "Foundation-Data structures fundamentals": true,
    "Foundation-Linux basics": false,
    "Core CS-OOP concepts": false,
    "Core CS-DBMS & SQL": true
  },
  "createdAt": "2026-03-29T10:00:00Z",
  "updatedAt": "2026-03-29T15:30:00Z"
}
```

---

## Web Scraping Flow

### **Step-by-Step Process**:

#### **Step 1: Fetch Target Role from StudentProfile**
```javascript
// In career.js - getPersonalizedRoadmap()
const profile = await StudentProfile.findOne({ userId });
// Gets: profile.targetRole = "Software Engineer"
```

#### **Step 2: Select Skills Based on Target Role**
```javascript
// From hardcoded roadmaps object
const roadmap = roadmaps["Software Engineer"];
// roadmap.semesters[0].skills = ["Python", "Data Structures", "Linux", "Git"]
```

#### **Step 3: Web Scrape Resources for Each Skill**
```javascript
// In career.js - for each skill in semester
for (let skillIndex = 0; skillIndex < semester.skills.length; skillIndex++) {
  const skill = semester.skills[skillIndex]; // e.g., "Python"
  
  // Call web scraper service
  const resources = await resourceScraper.getResourcesForSkill(skill, {
    limit: 3,
    platforms: ['github', 'udemy', 'coursera', 'youtube', 'geeksforgeeks']
  });
  
  semester.resources[skillIndex] = resources;
}
```

#### **Step 4: Web Scraper Fetches from Multiple Sources**
**resourceScraper.js methods**:
```javascript
// 1. Udemy API
scrapeUdemy(skill)
  → https://www.udemy.com/api-2.0/courses/?search=Python
  → Returns: [{ title: "...", platform: "Udemy", price: "$XX", rating: 4.8 }, ...]

// 2. Coursera (HTML Scraping with cheerio)
scrapeCoursera(skill)
  → https://www.coursera.org/search?query=Python
  → Parses HTML, extracts course data
  → Returns: [{ title: "...", platform: "Coursera", institution: "..." }, ...]

// 3. GitHub API
scrapeGitHub(skill)
  → https://api.github.com/search/repositories?q=Python tutorial&sort=stars
  → Returns: [{ title: "...", platform: "GitHub", stars: 5000 }, ...]

// 4. YouTube (Direct Link)
scrapeYouTube(skill)
  → https://www.youtube.com/results?search_query=learn+Python
  → Returns: [{ title: "Learn Python - YouTube", url: "..." }, ...]

// 5. GeeksforGeeks (Direct Link)
scrapeGeeksForGeeks(skill)
  → https://www.geeksforgeeks.org/?s=Python
  → Returns: [{ title: "Python Tutorial - GeeksforGeeks", url: "..." }, ...]
```

#### **Step 5: Cache Results**
```javascript
// In resourceScraper.js
this.cache[skillKey] = {
  data: resources,
  timestamp: Date.now()
};
// Cached for 24 hours - prevents re-scraping same skill
```

#### **Step 6: Save Checklist & Return Response**
```javascript
// Create or update RoadmapChecklist
const checklist = await getOrCreateChecklist(userId, role);
// Returns RoadmapChecklist with empty items initially

// Return to Frontend
res.json({
  role: "Software Engineer",
  roadmap: { semesters: [...] },
  checklistId: "507f1f77bcf86cd799439011",
  availableRoles: ["Software Engineer", "Data Scientist", "DevOps Engineer", ...]
})
```

---

## Skill Representation in Different Stages

### **Stage 1: StudentProfile Collection (Extracted Skills)**
```javascript
// From resume parsing
extractedSkills: ["Python", "JavaScript", "React", "Node.js", "SQL"]
```

### **Stage 2: Roadmap Object (Role-Based Skills)**
```javascript
// Hardcoded template for each role
roadmaps["Software Engineer"].semesters[0].skills = [
  "Python",
  "Data Structures",
  "Linux basics",
  "Git basics"
]
```

### **Stage 3: Scraped Resources (Skill → Learning Sources)**
```javascript
// From web scraper
{
  skill: "Python",
  resources: [
    { title: "Python Official Tutorial", url: "...", platform: "Official" },
    { title: "Real Python Course", url: "...", platform: "Udemy", rating: 4.9 },
    { title: "Python Tutorial on YouTube", url: "...", platform: "YouTube" }
  ]
}
```

### **Stage 4: Tracked Skills (Checklist)**
```javascript
// In RoadmapChecklist
items: {
  "Foundation-Python": true,        // Completed
  "Foundation-Data Structures": false // Not completed
}
```

---

## Database Query Summary

| Collection | Purpose | When Accessed | Key Fields |
|-----------|---------|---------------|-----------|
| **StudentProfile** | Store user's target role and extracted skills | On roadmap load | `targetRole`, `extractedSkills` |
| **RoadmapChecklist** | Track which roadmap tasks user completed | On checklist item toggle | `userId`, `role`, `items` |
| **(None - Hardcoded)** | Roadmap templates for each role | Pre-defined in career.js | Skill lists per semester |
| **(External APIs)** | Web scraped learning resources | For each skill in roadmap | Udemy, Coursera, GitHub APIs |

---

## API Endpoints

### **1. GET /career/personalized?role=Software Engineer**
- **Queries**: StudentProfile collection
- **Uses**: targetRole, extractedSkills
- **Scrapes**: Resources for all skills in that role
- **Returns**: Roadmap + resources + checklistId

### **2. GET /career/checklist/:checklistId**
- **Queries**: RoadmapChecklist collection
- **Returns**: Saved completion items

### **3. POST /career/checklist/item**
- **Updates**: RoadmapChecklist collection
- **Saves**: Individual task completion

---

## Summary

✅ **Target Role**: Stored in `StudentProfile.targetRole`
✅ **Extracted Skills**: Stored in `StudentProfile.extractedSkills`
✅ **Roadmap Skills**: Hardcoded in `roadmaps` object in career.js
✅ **Web Scraping**: Fetches from Udemy, Coursera, GitHub, YouTube, GeeksforGeeks APIs
✅ **Checklist Tracking**: Stored in `RoadmapChecklist` collection
