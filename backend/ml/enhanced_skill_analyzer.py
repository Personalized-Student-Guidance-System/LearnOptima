"""
Enhanced Skill Gap Analyzer with ML and Dynamic NLP
═══════════════════════════════════════════════════════════════════════════════

Replaces the old hardcoded ROLE_SKILLS_IMPORTANCE dict with a dynamic pipeline:
  1. Attempts to get live-scraped skills from skill_gap_analyzer
  2. Falls back to a small static catalogue only if scraping unavailable
  3. Uses sentence-transformer (or TF-IDF) for semantic skill matching
  4. ML-based priority scoring with prerequisites, demand, and time estimates
"""

import numpy as np
import json
import sys
from typing import List, Dict, Optional
from collections import Counter

# ── Import the dynamic analyzer ──────────────────────────────────────────────
try:
    from skill_extractor import (
        extract_skills_from_text,
        semantic_skill_match,
    )
    _EXTRACTOR_AVAILABLE = True
except ImportError:
    _EXTRACTOR_AVAILABLE = False

try:
    from skill_gap_analyzer import analyze_skill_gap as _dynamic_analyze
    _DYNAMIC_AVAILABLE = True
except ImportError:
    _DYNAMIC_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
#  Small static fallback — ONLY used when dynamic pipeline is unavailable
# ─────────────────────────────────────────────────────────────────────────────
_FALLBACK_ROLE_SKILLS = {
    'Software Engineer': [
        'javascript', 'python', 'data structures', 'algorithms',
        'git', 'sql', 'system design', 'react', 'nodejs',
        'rest api', 'testing', 'docker',
    ],
    'Data Scientist': [
        'python', 'machine learning', 'statistics', 'sql',
        'tensorflow', 'pandas', 'numpy', 'data visualization',
        'scikit-learn', 'deep learning',
    ],
    'DevOps Engineer': [
        'docker', 'kubernetes', 'ci/cd', 'linux', 'aws',
        'terraform', 'monitoring', 'bash', 'jenkins', 'git',
    ],
    'Frontend Developer': [
        'react', 'javascript', 'css', 'html', 'typescript',
        'figma', 'webpack', 'redux', 'rest api', 'testing',
    ],
    'ML Engineer': [
        'python', 'deep learning', 'tensorflow', 'pytorch',
        'statistics', 'mathematics', 'computer vision',
        'nlp', 'data processing', 'sql',
    ],
    'Backend Developer': [
        'nodejs', 'python', 'sql', 'rest api',
        'microservices', 'docker', 'redis', 'postgresql',
        'authentication', 'testing',
    ],
}

# Skill prerequisites - high-level map, fallback empty for unknown skills
SKILL_PREREQUISITES = {
    'react': ['javascript', 'html', 'css'],
    'nodejs': ['javascript'],
    'system design': ['data structures', 'algorithms'],
    'machine learning': ['python', 'statistics', 'linear algebra'],
    'deep learning': ['machine learning', 'python'],
    'docker': ['linux'],
    'kubernetes': ['docker', 'linux'],
    'tensorflow': ['python', 'machine learning'],
    'pytorch': ['python', 'machine learning'],
    'next.js': ['react', 'javascript'],
    'typescript': ['javascript'],
    'redux': ['react', 'javascript'],
    'graphql': ['rest api'],
    'mlops': ['docker', 'machine learning'],
    'ci/cd': ['git'],
    'aws': ['linux', 'networking'],
    'microservices': ['rest api', 'docker'],
}

# Time to proficiency estimates (days)
TIME_TO_PROFICIENCY = {
    'javascript': 30, 'python': 35, 'react': 40, 'nodejs': 35,
    'sql': 20, 'docker': 25, 'kubernetes': 45, 'git': 10,
    'rest api': 20, 'testing': 25, 'data structures': 45,
    'algorithms': 60, 'system design': 60, 'machine learning': 90,
    'deep learning': 120, 'tensorflow': 50, 'pytorch': 50,
    'typescript': 25, 'css': 20, 'html': 15, 'linux': 30,
    'aws': 45, 'ci/cd': 20, 'terraform': 35, 'statistics': 40,
    'pandas': 20, 'numpy': 15, 'data visualization': 25,
}


def normalize_skill(skill: str) -> str:
    """Normalize skill name for comparison."""
    return skill.lower().strip().replace('_', ' ').replace('+', 'plus')


def _get_dynamic_required_skills(target_role: str) -> Optional[Dict[str, int]]:
    """
    Try to get dynamically scraped skills for a role.
    Returns {skill: importance_score} or None if unavailable.
    """
    if not _DYNAMIC_AVAILABLE:
        return None

    try:
        # Use the dynamic analyzer — it scrapes live job data
        result = _dynamic_analyze([], target_role)
        required = result.get("required_skills", [])
        if not required:
            return None

        # Convert frequency-ranked list to importance scores (100 → 40)
        importance = {}
        for i, skill in enumerate(required):
            score = max(40, 100 - i * 4)  # Top skill = 100, each next = -4
            importance[skill.lower()] = score

        print(f"[EnhancedAnalyzer] Dynamic skills for '{target_role}': {len(importance)} skills")
        return importance

    except Exception as e:
        print(f"[EnhancedAnalyzer] Dynamic fetch failed: {e}", file=sys.stderr)
        return None


def _get_required_skills(target_role: str) -> Dict[str, int]:
    """
    Get required skills for a role.
    Priority: Dynamic (scraped) → Static fallback
    Returns {skill: importance_score}
    """
    # Try dynamic first
    dynamic = _get_dynamic_required_skills(target_role)
    if dynamic and len(dynamic) >= 5:
        return dynamic

    # Static fallback
    rl = target_role.lower().strip()
    for key, skills in _FALLBACK_ROLE_SKILLS.items():
        if key.lower() == rl or rl in key.lower() or key.lower() in rl:
            return {s: max(40, 100 - i * 5) for i, s in enumerate(skills)}

    # Default to Software Engineer
    skills = _FALLBACK_ROLE_SKILLS.get('Software Engineer', [])
    return {s: max(40, 100 - i * 5) for i, s in enumerate(skills)}


def calculate_skill_gap(user_skills: List[str], target_role: str) -> Dict:
    """
    Calculate skill gap using dynamic NLP + semantic matching.
    Falls back to TF-IDF exact matching if sentence-transformers unavailable.
    """
    user_lower = [normalize_skill(s) for s in user_skills]
    required = _get_required_skills(target_role)

    # Try semantic matching first
    if _EXTRACTOR_AVAILABLE and len(required) > 0:
        try:
            req_list = list(required.keys())
            matched_names, missing_names, similarity_score = semantic_skill_match(
                user_lower, req_list, threshold=0.55
            )

            matched = [{'skill': s, 'importance': required.get(s, 70)} for s in matched_names]
            missing = [{'skill': s, 'importance': required.get(s, 70)} for s in missing_names]

            # Weighted score
            matched_importance = sum(m['importance'] for m in matched)
            total_importance = sum(required.values())
            importance_score = round((matched_importance / total_importance) * 100, 1) if total_importance > 0 else 0
            final_score = round((importance_score * 0.6) + (similarity_score * 0.4), 1)

            return {
                'matched': matched,
                'missing': missing,
                'match_score': final_score,
                'importance_score': importance_score,
                'semantic_similarity': round(similarity_score, 1),
                'matched_count': len(matched),
                'missing_count': len(missing),
                'total_required': len(required),
                'source': 'dynamic-nlp',
            }
        except Exception as e:
            print(f"[EnhancedAnalyzer] Semantic matching failed, using exact: {e}", file=sys.stderr)

    # Exact matching fallback
    matched = []
    missing = []
    for skill, importance in required.items():
        if skill in user_lower or any(skill in u for u in user_lower):
            matched.append({'skill': skill, 'importance': importance})
        else:
            missing.append({'skill': skill, 'importance': importance})

    # TF-IDF similarity
    tfidf_similarity = 0.0
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        all_docs = [' '.join(user_lower), ' '.join(required.keys())]
        vectorizer = TfidfVectorizer()
        tfidf = vectorizer.fit_transform(all_docs)
        tfidf_similarity = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    except Exception:
        tfidf_similarity = len(matched) / max(len(required), 1)

    matched_importance = sum(m['importance'] for m in matched)
    total_importance = sum(required.values())
    importance_score = round((matched_importance / total_importance) * 100, 1) if total_importance > 0 else 0
    final_score = round((importance_score * 0.6) + (tfidf_similarity * 100 * 0.4), 1)

    return {
        'matched': matched,
        'missing': missing,
        'match_score': final_score,
        'importance_score': importance_score,
        'tfidf_similarity': round(tfidf_similarity * 100, 1),
        'matched_count': len(matched),
        'missing_count': len(missing),
        'total_required': len(required),
        'source': 'exact+tfidf-fallback',
    }


def prioritize_missing_skills(missing_skills: List[Dict], user_skills: List[str]) -> List[Dict]:
    """
    Prioritize missing skills using ML scoring based on:
    - Importance to role (from scraped frequency)
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

        # Get time estimate
        time_est = TIME_TO_PROFICIENCY.get(skill, 30)

        # Priority Score (0-100)
        # - Importance (from scraped frequency): 50%
        # - Prerequisites Met: 30%
        # - Time Efficiency (inverse): 20%
        time_efficiency = 1 - (time_est / 150)

        priority_score = round(
            (importance * 0.5) +
            (prereqs_met * 100 * 0.3) +
            (time_efficiency * 100 * 0.2),
            1
        )

        urgency = 'Critical' if priority_score >= 80 else 'High' if priority_score >= 60 else 'Medium'

        prioritized.append({
            'skill': skill,
            'importance': importance,
            'priority_score': priority_score,
            'urgency': urgency,
            'time_to_proficiency_days': time_est,
            'prerequisites_met_pct': round(prereqs_met * 100, 0),
            'prerequisites': prereqs,
            'interview_frequency': max(40, int(importance * 0.95)),
        })

    prioritized.sort(key=lambda x: x['priority_score'], reverse=True)
    return prioritized


def analyze_skill_gap(user_skills: List[str], target_role: str, skills_to_learn: List[str] = None) -> Dict:
    """
    Complete skill gap analysis with dynamic NLP + ML recommendations.
    """
    if skills_to_learn is None:
        skills_to_learn = []

    # Get base gap analysis (uses dynamic scraping if available)
    gap_analysis = calculate_skill_gap(user_skills, target_role)

    # Prioritize missing skills
    prioritized_missing = prioritize_missing_skills(gap_analysis['missing'], user_skills)

    # Summary analysis
    ms = gap_analysis['match_score']
    mc = gap_analysis['matched_count']
    tr = gap_analysis['total_required']
    mn = gap_analysis['missing_count']

    if ms >= 80:
        analysis_text = f"Excellent! You have {mc}/{tr} core skills for {target_role}. Focus on specialization and depth."
    elif ms >= 60:
        analysis_text = f"Good progress! You have {mc}/{tr} skills. {mn} more to master for {target_role}."
    elif ms >= 40:
        analysis_text = f"You're building up — {mc}/{tr} skills matched. Focus on the {min(3, mn)} Critical-priority skills first."
    else:
        analysis_text = f"Starting your {target_role} journey — prioritize the top {min(3, mn)} skills from live job data."

    top_5 = prioritized_missing[:5]

    return {
        'overview': {
            'match_score': gap_analysis['match_score'],
            'matched_count': mc,
            'missing_count': mn,
            'total_required': tr,
            'analysis': analysis_text,
        },
        'matched_skills': gap_analysis['matched'],
        'missing_skills': prioritized_missing,
        'top_5_priorities': top_5,
        'learning_queue': skills_to_learn.copy(),
        'recommended_learning_time_days': sum(s['time_to_proficiency_days'] for s in top_5),
        'role': target_role,
        'source': gap_analysis.get('source', 'unknown'),
    }


def get_learning_path(user_skills: List[str], target_role: str, num_skills: int = 10) -> Dict:
    """Generate an ordered learning path with time estimates."""
    gap = analyze_skill_gap(user_skills, target_role)

    learning_path = []
    current_day = 0

    for i, skill_info in enumerate(gap['missing_skills'][:num_skills]):
        days = skill_info['time_to_proficiency_days']
        start_week = (current_day // 7) + 1
        end_week = (current_day + days) // 7 + 1

        learning_path.append({
            'order': i + 1,
            'skill': skill_info['skill'],
            'urgency': skill_info['urgency'],
            'duration_days': days,
            'duration_weeks': (days // 7) + 1,
            'start_week': start_week,
            'end_week': end_week,
            'prerequisites': skill_info['prerequisites'],
        })
        current_day += days

    return {
        'role': target_role,
        'total_duration_weeks': (current_day // 7) + 1,
        'learning_path': learning_path,
        'estimated_completion_date': f"Week {(current_day // 7) + 1}",
    }


if __name__ == '__main__':
    user_skills = ['Python', 'SQL', 'JavaScript', 'Git']
    result = analyze_skill_gap(user_skills, 'Data Scientist')
    print(json.dumps(result, indent=2))
