# 🎓 StudentFriend — AI-Powered Academic Companion

A full-stack web application to help students manage academics, plan careers, track goals, and predict burnout.

## 🏗️ Tech Stack
- **Frontend**: React 18, Chart.js, React Router v6
- **Backend**: Node.js, Express, MongoDB (Mongoose), JWT Auth
- **ML**: Python, Flask, scikit-learn, BeautifulSoup

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
docker-compose up --build
```

### Option 2: Manual

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

**ML API (optional):**
```bash
cd backend/ml
pip install -r requirements.txt
python burnout_model.py   # train model first
python ml_api.py          # starts on port 5001
```

## 📱 Features

| Feature | Description |
|---|---|
| 📊 Dashboard | Stats, charts, quick actions, today's schedule |
| 📅 Smart Planner | Weekly calendar + AI study plan generator |
| 🎯 Goal Analyzer | Goals with AI analysis and progress tracking |
| 📚 Academic Data | Marks entry, grade calculator, CGPA tracker |
| ⚡ Skill Gap | Skill comparison against 8 target roles with radar chart |
| 🗺️ Career Roadmap | Semester-wise interactive career roadmap |
| 🔥 Burnout Predictor | ML-based risk assessment with suggestions |
| 👤 Profile | Skills, interests, and profile management |

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `ML_API_URL` | Flask ML service URL |
| `PORT` | Backend port (default: 5000) |

## 📡 API Endpoints

- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `GET/POST/PUT/DELETE /api/planner` — Tasks CRUD
- `POST /api/planner/ai-generate` — AI study plan
- `GET/POST/PUT/DELETE /api/goals` — Goals CRUD
- `POST /api/goals/:id/analyze` — AI goal analysis
- `GET/POST/DELETE /api/academic` — Subjects CRUD
- `GET /api/academic/cgpa` — Calculate CGPA
- `POST /api/burnout/predict` — Predict burnout
- `GET /api/skills/gap-analysis` — Skill gap analysis
- `GET /api/career` — Career roadmap