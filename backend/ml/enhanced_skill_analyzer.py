"""
Enhanced Skill Gap Analyzer with ML and Agentic AI
Analyzes skill gaps using ML models and provides personalized recommendations
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict
import json

# Role requirements with skill importance scoring (0-100)
ROLE_SKILLS_IMPORTANCE = {
    'Software Engineer': {
        'javascript': 95, 'python': 90, 'data structures': 98, 'algorithms': 97,
        'git': 85, 'sql': 85, 'system design': 90, 'react': 80, 'nodejs': 80,
        'rest api': 85, 'testing': 70, 'docker': 75
    },
    'Data Scientist': {
        'python': 98, 'machine learning': 95, 'statistics': 90, 'sql': 85,
        'tensorflow': 85, 'pandas': 88, 'numpy': 88, 'visualization': 75,
        'scikitlearn': 85, 'jupyter notebooks': 70
    },
    'DevOps Engineer': {
        'docker': 95, 'kubernetes': 95, 'cicd': 90, 'linux': 98, 'aws': 90,
        'terraform': 85, 'monitoring': 80, 'bash': 90, 'jenkins': 75,
        'git': 85, 'networking': 70
    },
    'Frontend Developer': {
        'react': 95, 'javascript': 98, 'css': 95, 'html': 95, 'typescript': 85,
        'figma': 70, 'webpack': 70, 'redux': 75, 'rest api': 75, 'testing': 70
    },
    'ML Engineer': {
        'python': 98, 'deep learning': 95, 'tensorflow': 95, 'pytorch': 90,
        'statistics': 85, 'mathematics': 90, 'computer vision': 80,
        'nlp': 80, 'data processing': 85, 'sql': 75
    },
    'Backend Developer': {
        'nodejs': 95, 'python': 90, 'sql': 95, 'rest api': 98,
        'microservices': 85, 'docker': 80, 'redis': 75, 'postgresql': 80,
        'authentication': 80, 'testing': 75
    }
}

# Skill prerequisites - skills that should be learned before others
SKILL_PREREQUISITES = {
    'react': ['javascript', 'html', 'css'],
    'nodejs': ['javascript', 'databases'],
    'system design': ['data structures', 'algorithms', 'networking'],
    'machine learning': ['python', 'statistics', 'linear algebra'],
    'deep learning': ['machine learning', 'neural networks', 'python'],
    'docker': ['linux', 'command line'],
    'kubernetes': ['docker', 'linux'],
    'tensorflow': ['python', 'machine learning'],
    'pytorch': ['python', 'machine learning'],
}

# Job market demand weight (how often skill appears in job descriptions) - 0-100
JOB_MARKET_DEMAND = {
    'python': 98, 'javascript': 96, 'react': 92, 'nodejs': 88,
    'sql': 94, 'docker': 85, 'kubernetes': 75, 'aws': 92,
    'git': 95, 'rest api': 90, 'testing': 80, 'system design': 85,
    'data structures': 98, 'algorithms': 95
}

# Time to proficiency (days of study)
TIME_TO_PROFICIENCY = {
    'javascript': 30, 'python': 35, 'react': 40, 'nodejs': 35,
    'sql': 20, 'docker': 25, 'kubernetes': 45, 'git': 10,
    'rest api': 20, 'testing': 25, 'data structures': 45,
    'algorithms': 60, 'system design': 60, 'machine learning': 90,
    'deep learning': 120, 'tensorflow': 50, 'pytorch': 50
}

def normalize_skill(skill: str) -> str:
    """Normalize skill name for comparison"""
    return skill.lower().strip().replace('_', ' ').replace('+', 'plus')

def calculate_skill_gap(user_skills: List[str], target_role: str, weights: Dict = None) -> Dict:
    """
    Calculate skill gap using TF-IDF similarity and importance weighting
    
    Args:
        user_skills: List of user's current skills
        target_role: Target role
        weights: Custom importance weights
    
    Returns:
        Detailed gap analysis
    """
    user_lower = [normalize_skill(s) for s in user_skills]
    required = ROLE_SKILLS_IMPORTANCE.get(target_role, ROLE_SKILLS_IMPORTANCE['Software Engineer'])
    
    # Exact matching
    matched = []
    missing = []
    
    for skill, importance in required.items():
        if skill in user_lower or any(skill in u for u in user_lower):
            matched.append({'skill': skill, 'importance': importance})
        else:
            missing.append({'skill': skill, 'importance': importance})
    
    # TF-IDF similarity for fuzzy matching
    all_docs = [' '.join(user_lower), ' '.join(required.keys())]
    vectorizer = TfidfVectorizer()
    try:
        tfidf = vectorizer.fit_transform(all_docs)
        tfidf_similarity = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    except:
        tfidf_similarity = len(matched) / max(len(required), 1)
    
    # Calculate match score
    matched_importance = sum(m['importance'] for m in matched)
    total_importance = sum(required.values())
    importance_score = round((matched_importance / total_importance) * 100, 1) if total_importance > 0 else 0
    
    # Weighted score: 60% importance + 40% TF-IDF
    final_score = round((importance_score * 0.6) + (tfidf_similarity * 100 * 0.4), 1)
    
    return {
        'matched': matched,
        'missing': missing,
        'match_score': final_score,
        'importance_score': importance_score,
        'tfidf_similarity': round(tfidf_similarity * 100, 1),
        'matched_count': len(matched),
        'missing_count': len(missing),
        'total_required': len(required)
    }

def prioritize_missing_skills(missing_skills: List[Dict], user_skills: List[str]) -> List[Dict]:
    """
    Prioritize missing skills using ML scoring based on:
    - Importance to role
    - Job market demand
    - Prerequisites readiness
    - Time to proficiency
    """
    user_lower = [normalize_skill(s) for s in user_skills]
    
    prioritized = []
    
    for skill_info in missing_skills:
        skill = skill_info['skill']
        importance = skill_info['importance']
        
        # Check prerequisites
        prereqs = SKILL_PREREQUISITES.get(skill, [])
        prereqs_met = sum(1 for p in prereqs if p in user_lower) / max(len(prereqs), 1)
        
        # Get demand and time
        demand = JOB_MARKET_DEMAND.get(skill, 60)
        time = TIME_TO_PROFICIENCY.get(skill, 30)
        
        # ML Priority Score (0-100)
        # - Importance: 40%
        # - Job Market Demand: 30%
        # - Prerequisites Met: 20%
        # - Time Efficiency (inverse): 10%
        time_efficiency = 1 - (time / 150)  # Normalize to 0-1
        
        priority_score = round(
            (importance * 0.4) + 
            (demand * 0.3) + 
            (prereqs_met * 100 * 0.2) + 
            (time_efficiency * 100 * 0.1),
            1
        )
        
        urgency = 'Critical' if priority_score >= 80 else 'High' if priority_score >= 60 else 'Medium'
        
        prioritized.append({
            'skill': skill,
            'importance': importance,
            'demand': demand,
            'priority_score': priority_score,
            'urgency': urgency,
            'time_to_proficiency_days': time,
            'prerequisites_met_pct': round(prereqs_met * 100, 0),
            'prerequisites': prereqs
        })
    
    # Sort by priority score
    prioritized.sort(key=lambda x: x['priority_score'], reverse=True)
    
    return prioritized

def analyze_skill_gap(user_skills: List[str], target_role: str, skills_to_learn: List[str] = None) -> Dict:
    """
    Complete skill gap analysis with ML recommendations
    """
    if skills_to_learn is None:
        skills_to_learn = []
    
    # Get base gap analysis
    gap_analysis = calculate_skill_gap(user_skills, target_role)
    
    # Prioritize missing skills
    prioritized_missing = prioritize_missing_skills(gap_analysis['missing'], user_skills)
    
    # Add user's custom learning queue
    learning_queue = skills_to_learn.copy()
    
    # Summary analysis
    analysis_text = ""
    if gap_analysis['match_score'] >= 80:
        analysis_text = f"Excellent! You have {gap_analysis['matched_count']}/{gap_analysis['total_required']} core skills. Focus on specialization."
    elif gap_analysis['match_score'] >= 60:
        analysis_text = f"Good progress! You have {gap_analysis['matched_count']}/{gap_analysis['total_required']} skills. {gap_analysis['missing_count']} more to master."
    elif gap_analysis['match_score'] >= 40:
        analysis_text = f"You're on track. Build foundations with the {gap_analysis['missing_count']} critical skills."
    else:
        analysis_text = f"Starting journey. Prioritize the top {min(3, gap_analysis['missing_count'])} skills first."
    
    # Top recommendations (next 5 critical skills)
    top_recommendations = prioritized_missing[:5]
    
    return {
        'overview': {
            'match_score': gap_analysis['match_score'],
            'matched_count': gap_analysis['matched_count'],
            'missing_count': gap_analysis['missing_count'],
            'total_required': gap_analysis['total_required'],
            'analysis': analysis_text
        },
        'matched_skills': gap_analysis['matched'],
        'missing_skills': prioritized_missing,
        'top_5_priorities': top_recommendations,
        'learning_queue': learning_queue,
        'recommended_learning_time_days': sum(s['time_to_proficiency_days'] for s in top_recommendations),
        'role': target_role
    }

def get_learning_path(user_skills: List[str], target_role: str, num_skills: int = 10) -> Dict:
    """
    Generate an ordered learning path with time estimates
    """
    gap = analyze_skill_gap(user_skills, target_role)
    
    # Create timeline for top skills
    learning_path = []
    current_day = 0
    
    for i, skill_info in enumerate(gap['missing_skills'][:num_skills]):
        skill = skill_info['skill']
        days = skill_info['time_to_proficiency_days']
        start_week = (current_day // 7) + 1
        end_week = (current_day + days) // 7 + 1
        
        learning_path.append({
            'order': i + 1,
            'skill': skill,
            'urgency': skill_info['urgency'],
            'duration_days': days,
            'duration_weeks': (days // 7) + 1,
            'start_week': start_week,
            'end_week': end_week,
            'prerequisites': skill_info['prerequisites']
        })
        
        current_day += days
    
    return {
        'role': target_role,
        'total_duration_weeks': (current_day // 7) + 1,
        'learning_path': learning_path,
        'estimated_completion_date': f"Week {(current_day // 7) + 1}"
    }

if __name__ == '__main__':
    # Test
    user_skills = ['Python', 'SQL', 'JavaScript', 'Git']
    result = analyze_skill_gap(user_skills, 'Data Scientist')
    print(json.dumps(result, indent=2))
