import numpy as np
import math
from typing import List, Dict, Any
from datetime import datetime, timedelta
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib
import os

from fast_scraper import FastJobScraper as RealJobScraper

class NLPAnalyzerAgent:
    """Uses TF-IDF + Cosine Similarity to compare scraped trends with user skills."""
    def __init__(self):
        self.vectorizer = TfidfVectorizer(lowercase=True, stop_words='english')

    def analyze_skill_gap(self, required_skills: List[str], user_skills: List[str]) -> Dict[str, Any]:
        user_skills_clean = [s.lower().strip() for s in user_skills]
        required_clean = [s.lower().strip() for s in required_skills]
        
        # Simple exact/substring matching first
        matched = []
        missing = []
        
        for req in required_skills:
            req_c = req.lower().strip()
            # If the specific skill is fully contained in any user skill (or vice versa)
            if any(req_c in us or us in req_c for us in user_skills_clean):
                matched.append(req)
            else:
                missing.append(req)
                
        # Semantic similarity for overall score
        all_docs = [' '.join(user_skills_clean), ' '.join(required_clean)]
        try:
            tfidf = self.vectorizer.fit_transform(all_docs)
            similarity = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        except ValueError:
            similarity = len(matched) / (len(required_skills) or 1)

        return {
            'matched': matched,
            'missing': missing,
            'match_score': round(similarity * 100, 1),
            'trending_missing': missing[:8] # High priority missing skills
        }


class CareerResearcherAgent:
    """Scrapes the web to find required skills for any arbitrary role/exam."""
    def __init__(self):
        self.scraper = RealJobScraper()
        
    def generate_roadmap_structure(self, target_role: str, missing_skills: List[str]) -> List[Dict[str, Any]]:
        """Splits missing skills into up to 8 logical semesters/phases."""
        if not missing_skills:
            missing_skills = [f"Advanced {target_role} Concept 1", f"Advanced {target_role} Concept 2", "Interview Prep", "Mock Tests"]
            
        phases = []
        # Group missing skills into chunks of ~3 skills max per phase
        chunk_size = math.ceil(len(missing_skills) / 8) or 1
        
        phase_names = ['Foundation', 'Core Concepts', 'Intermediate', 'Advanced Tools', 'Applied Scenarios', 'Specialization', 'Deep Dive', 'Final Prep']
        
        for i in range(8):
            start_idx = i * chunk_size
            if start_idx >= len(missing_skills): break
                
            chunk_skills = missing_skills[start_idx : start_idx + chunk_size]
            
            phases.append({
                'sem': i + 1,
                'title': phase_names[i] if i < len(phase_names) else f'Phase {i+1}',
                'duration': '30 days',
                'skills': chunk_skills,
                'tasks': [f"Master {skill}" for skill in chunk_skills]
            })
            
        return phases

    def research_role(self, target_role: str, user_skills: List[str]) -> Dict[str, Any]:
        print(f"[CareerResearcherAgent] Researching {target_role}...")
        
        # Scrape dynamic skills based on job market trends
        scraped_skills = self.scraper.scrape_job_skills(target_role, num_jobs=5)
        
        if not scraped_skills:
             # Fallback if scraper fails or 0 jobs found (e.g. obscure exam)
             scraped_skills = ['Fundamentals', 'Domain Knowledge', 'Problem Solving', 'Data Analysis', 'Project Management', 'Communication']
             
        # Analyze the gap via NLP
        nlp_agent = NLPAnalyzerAgent()
        gap_analysis = nlp_agent.analyze_skill_gap(scraped_skills, user_skills)
        
        # Build phases purely based on what they are missing
        phases = self.generate_roadmap_structure(target_role, gap_analysis['missing'])
        
        return {
            'role': target_role,
            'gap_analysis': gap_analysis,
            'semesters': phases,
            'source': 'ai_agent'
        }


class BurnoutAwarePlannerAgent:
    """Takes Roadmap Phases and Academic Constraints -> Converts to daily safe schedule."""
    def __init__(self):
        self.model = None
        self.scaler = None
        
        try:
            if os.path.exists('burnout_model.pkl'):
                self.model = joblib.load('burnout_model.pkl')
                self.scaler = joblib.load('burnout_scaler.pkl')
        except Exception as e:
            print(f"[PlannerAgent] Burnout model load error: {e}")

    def predict_burnout(self, study_h, sleep_h, social_h, exercise_h, pressure, academic_load):
        if not self.model or not self.scaler:
            return 0  # Safe fallback
            
        features = np.array([[study_h, sleep_h, social_h, exercise_h, pressure, academic_load]])
        scaled = self.scaler.transform(features)
        proba = self.model.predict_proba(scaled)[0]
        # Return probability of 'High' or 'Critical' burnout (assuming classes: Low, Moderate, High, Critical)
        # Random Forest proba maps to classes. We want the sum of indices 2 & 3.
        # Check classes via self.model.classes_ if needed. Let's assume indices 2 (High), 3 (Critical).
        classes = list(self.model.classes_)
        high_idx = classes.index('High') if 'High' in classes else -1
        crit_idx = classes.index('Critical') if 'Critical' in classes else -1
        
        risk = 0.0
        if high_idx >= 0: risk += proba[high_idx]
        if crit_idx >= 0: risk += proba[crit_idx]
        return risk

    def generate_daily_schedule(self, roadmap_phases: List[Dict], existing_tasks: List[Dict], user_prefs: Dict) -> List[Dict]:
        """
        user_prefs = {'sleep_hours': 8, 'academic_load': 5, 'deadline_pressure': 5, 'max_study_hours': 4}
        """
        base_study = user_prefs.get('max_study_hours', 4)
        sleep = user_prefs.get('sleep_hours', 7)
        acad_load = user_prefs.get('academic_load', 5)
        pressure = user_prefs.get('deadline_pressure', 5)
        
        # Determine Safe Daily Study Hours using the model
        safe_study_hours = base_study
        for h in range(base_study, 0, -1):
            risk = self.predict_burnout(h, sleep, 1, 1, pressure, acad_load)
            if risk < 0.60: # 60% probability of burnout is our threshold
                safe_study_hours = h
                break
                
        if safe_study_hours < 1: safe_study_hours = 1 # Absolute min
        
        print(f"[PlannerAgent] Baseline allowed hours: {base_study}, Safe hours (burnout adjusted): {safe_study_hours}")
        
        # Map out days
        schedule = []
        current_date = datetime.now() + timedelta(days=1) # Start tomorrow
        
        # Flatten tasks from phases
        all_tasks = []
        for phase in roadmap_phases:
            for task in phase.get('tasks', []):
                all_tasks.append(task)
        
        rollover_tasks = [t for t in existing_tasks if t.get('rollovers', 0) < 3 and t.get('completed') == False]
        
        # Roll-over overdue first
        for task in rollover_tasks:
            tomorrow = current_date + timedelta(days=1)
            schedule.append({
                'title': f"ROLLOVER: {task.get('title', 'Task')}",
                'date': tomorrow.strftime('%Y-%m-%d'),
                'startTime': task.get('startTime', '09:00'),
                'endTime': task.get('endTime', '10:00'),
                'category': 'study',
                'priority': 'high',
                'aiGenerated': True,
                'rollovers': task.get('rollovers', 0) + 1
            })
        
        # Simple constraint heuristic iterator
        task_idx = 0
        days_generated = 0
        
        while task_idx < len(all_tasks) and days_generated < 60: # limit to 60 days of planning
            # Check if user has an exam or full leave on this day by checking existing_tasks
            current_date_str = current_date.strftime('%Y-%m-%d')
            day_busy_hours = 0
            has_exam = False
            
            for et in existing_tasks:
                if et.get('date', '').startswith(current_date_str):
                    if et.get('category') == 'exam':
                        has_exam = True
                    # Estimate hours
                    st = et.get('startTime', '00:00')
                    en = et.get('endTime', '01:00')
                    try:
                        h = int(en.split(':')[0]) - int(st.split(':')[0])
                        day_busy_hours += max(1, h)
                    except:
                        pass
                        
            # Dynamic rescheduling skip
            if has_exam or day_busy_hours >= safe_study_hours:
                current_date += timedelta(days=1)
                days_generated += 1
                continue
                
            # Place task in free slot
            remaining_capacity = safe_study_hours - day_busy_hours
            if remaining_capacity > 0:
                schedule.append({
                    'title': f"Roadmap: {all_tasks[task_idx]}",
                    'date': current_date_str,
                    'startTime': '17:00' if day_busy_hours == 0 else f"{17 + day_busy_hours}:00",
                    'endTime': f"{17 + day_busy_hours + min(2, remaining_capacity)}:00",
                    'category': 'study',
                    'priority': 'high',
                    'aiGenerated': True,
                    'notes': 'Automatically scheduled by BurnoutAwarePlanner'
                })
                task_idx += 1
                
            current_date += timedelta(days=1)
            days_generated += 1
            
        return schedule
    
    def orchestrate(self, user_data: Dict) -> Dict:
        """
        Full agentic orchestration: Burnout → Decision → Schedule
        user_data = {'riskScore': 65, 'undoneCount': 2, 'events': [...], 'phases': [...], 'action': 'heavy_reschedule'}
        """
        print(f"[Orchestrator] Risk: {user_data.get('riskScore')}, Undone: {user_data.get('undoneCount')}")
        
        phases = user_data.get('phases', [])
        events = user_data.get('events', [])
        existing_tasks = user_data.get('existing_tasks', [])
        prefs = user_data.get('user_prefs', {})
        
        # Decision adjustments
        action = user_data.get('action', 'roadmap_sync')
        if action == 'heavy_reschedule':
            prefs['max_study_hours'] = max(1, prefs.get('max_study_hours', 4) * 0.6) # Reduce load
        elif action == 'coach_intervention':
            prefs['max_study_hours'] = prefs.get('max_study_hours', 4) * 0.8
        
        tasks = self.generate_daily_schedule(phases, existing_tasks, prefs)
        
        return {
            'tasks': tasks,
            'summary': f"Orchestrated {len(tasks)} tasks | Action: {action} | Safe hrs/day: {prefs.get('max_study_hours')}",
            'risk_adjusted': True
        }
