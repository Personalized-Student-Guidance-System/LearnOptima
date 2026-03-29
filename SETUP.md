# LearnOptima – Setup & Data Guide

## Where data is saved

All user and profile data is stored in **MongoDB** (connection string in `backend/.env` as `MONGO_URI`).

| Data | Collection / source | Notes |
|------|----------------------|--------|
| **User** (name, email, password, onboarding step) | `User` | Auth and onboarding progress |
| **Student profile** (branch, semester, college, CGPA, goals, interests, skills, resume URL, syllabus, timetable) | `StudentProfile` | One document per user, linked by `userId` |
| Tasks | `Task` | Planner tasks |
| Goals | `Goal` | Goal tracker |
| Subjects & grades | `Subject` | Used to compute CGPA in Academics |

- **Profile page** and **Dashboard** use the **merged profile**: `GET /api/profile` returns User + StudentProfile combined. Saving in Profile updates both where needed.
- **Onboarding** writes to `StudentProfile` and updates `User.onboardingStep` / `User.onboardingCompleted`.

---

## How resume and syllabus data are parsed and stored

### Resume

1. **Upload**  
   User uploads a file in **Onboarding Step 2**. The file is sent to **POST /api/onboarding/resume** (multipart).

2. **Storage**  
   - If Cloudinary is configured: file is uploaded to Cloudinary; the **public URL** is stored in **MongoDB** in `StudentProfile.resumeUrl`.  
   - If not: a placeholder URL is stored and the file is not persisted.

3. **Parsing**  
   - The **Node backend** does **not** parse the PDF itself.  
   - It calls the **Python ML service** (if `ML_SERVICE_URL` is set):  
     **POST** `{ML_SERVICE_URL}/ml/parse-resume` with body `{ "resume_url": "<cloudinary_or_placeholder_url>" }`.  
   - The ML service is expected to: download the file from that URL (or receive it another way if you change the API), extract text (e.g. via PyMuPDF/pdfplumber), then extract **skills** and **projects** (e.g. with NLP or keyword matching).  
   - It returns JSON like: `{ "skills": ["Python", "React", ...], "projects": ["AI Chatbot", ...] }`.

4. **Where it’s stored**  
   - **Resume URL:** `StudentProfile.resumeUrl` (MongoDB).  
   - **Parsed skills:** `StudentProfile.extractedSkills` (array of strings).  
   - **Parsed projects:** merged into `StudentProfile.projects` (array of strings).  
   - All of this lives in the **StudentProfile** document for that user in MongoDB. The merged skills (e.g. `extractedSkills` + `extraSkills`) are what you see in Profile, Skill Gap, and Dashboard.

5. **If ML is not running**  
   - The Node backend still saves `resumeUrl` and advances the onboarding step.  
   - It calls the ML endpoint; if the call fails (e.g. connection refused), it catches the error and sets `extractedSkills = []` and does not add any projects. So **parsed** data is only present when the ML service is running and returns successfully.

### Syllabus

1. **Upload**  
   User uploads a file in **Onboarding Step 4**. The file is sent to **POST /api/onboarding/syllabus** (multipart).

2. **Storage**  
   - Same as resume: if Cloudinary is set, the file is uploaded and the URL is stored in **MongoDB** in `StudentProfile.syllabusUrl`.  
   - Otherwise a placeholder URL is stored.

3. **Parsing**  
   - **Right now there is no syllabus parsing.**  
   - The backend only saves `syllabusUrl` and sets `syllabusSubjects = []` (or keeps existing values). No ML or PDF parsing is called for the syllabus.

4. **Where it’s stored**  
   - **Syllabus URL:** `StudentProfile.syllabusUrl` (MongoDB).  
   - **Subject list:** `StudentProfile.syllabusSubjects` (array of strings). Currently this is never filled by parsing; it stays empty unless you add a syllabus-parsing step (see below).

5. **Adding syllabus parsing later**  
   - You can add a Python ML endpoint, e.g. **POST /ml/extract-syllabus** with `{ "syllabus_url": "..." }`, that returns `{ "subjects": ["Subject A", "Subject B", ...] }`.  
   - In **onboardingController.syllabusStep**, after uploading to Cloudinary, call that endpoint and set `profile.syllabusSubjects = response.subjects` before saving. Then the **parsed** subjects will be stored in **MongoDB** in `StudentProfile.syllabusSubjects`.

---

## CGPA and how it’s shown

- **Dashboard / Profile / Academics** show CGPA from:
  1. **Academics (subjects)** – If you add subjects with marks in **Academics**, the app computes CGPA from grades and credits and uses that when available.
  2. **Profile** – You can type **CGPA** in **Profile** (e.g. 8.5). It’s stored in `StudentProfile.cgpa` and shown when you don’t have subject-based CGPA or as an override.
- **Resume and GPA** – Right now, GPA is **not** read from the resume. Resume upload is used to:
  - Store the file (e.g. on Cloudinary)
  - Extract **skills** and **projects** (via the optional ML service)
- **Future (ML)** – If you add a Python ML service that parses resumes and returns a `gpa` field, the backend can be extended to save it into `StudentProfile.cgpa` the same way it saves `extractedSkills`. Until then, users should enter CGPA in **Profile** or **Academics**.

---

## Cloudinary (file uploads)

Resume, syllabus, and timetable uploads can be stored in **Cloudinary**. Without it, the app still runs but stores placeholder URLs.

### 1. Get Cloudinary API keys

1. Go to [https://cloudinary.com](https://cloudinary.com) and sign up / log in.
2. Open the **Dashboard**.
3. You’ll see:
   - **Cloud name**
   - **API Key**
   - **API Secret** (click “Reveal” if needed).

### 2. Where to paste them

In **`backend/.env`** add (replace with your values):

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Do **not** commit `.env` or share these values in code or in public repos.

### 3. Restart backend

After saving `.env`, restart the backend (e.g. `npm start` in `backend/`). Uploads will then go to Cloudinary and the returned URLs are saved in MongoDB (`StudentProfile`: `resumeUrl`, `syllabusUrl`, `timetableUrl`).

### 4. Finding uploaded files in Cloudinary

In the Cloudinary **Media Library**, uploaded files live under the **learnoptima** folder (e.g. `learnoptima/resumes`, `learnoptima/syllabus`, `learnoptima/timetables`). Use **All** or **Resources** view if PDFs or raw files don’t appear in the default view. The app does not delete these files; students can open them via the **Profile → Documents & parsed data** links.

---

## Optional: Python ML service

For resume parsing (skills/projects) and timetable OCR, a separate **Python ML service** can run (e.g. FastAPI on port 8000). The Node backend calls it only when configured.

In **`backend/.env`**:

```env
ML_SERVICE_URL=http://localhost:8000
```

If this is not set or the service is not running, the app still works; skills/timetable from ML are just empty and no errors are thrown (ML logs are kept quiet in production).

---

## No errors in terminal

- **Backend** – ML service errors (e.g. connection refused) are no longer logged as noisy `console.error`; they’re handled and empty data is returned.
- **Frontend** – Ensure `axios` base URL and `/api` proxy (e.g. in Vite) point to your backend so `/profile`, `/planner`, `/goals`, `/academic/cgpa` don’t 404.
- **Profile** – Use only `GET /api/profile` and `PUT /api/profile` for profile data; Dashboard and Profile both use this merged API so there are no duplicate or conflicting sources.

If you see a specific error in the terminal or browser, share the exact message and stack trace to fix it.
