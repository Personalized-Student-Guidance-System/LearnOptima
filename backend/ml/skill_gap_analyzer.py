import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROLE_SKILLS = {
    'Software Engineer': ['javascript', 'python', 'data structures', 'algorithms', 'git', 'sql', 'system design', 'react', 'nodejs'],
    'Data Scientist': ['python', 'machine learning', 'statistics', 'sql', 'tensorflow', 'pandas', 'numpy', 'visualization'],
    'DevOps Engineer': ['docker', 'kubernetes', 'cicd', 'linux', 'aws', 'terraform', 'monitoring', 'bash'],
    'Frontend Developer': ['react', 'javascript', 'css', 'html', 'typescript', 'figma', 'webpack'],
    'Backend Developer': ['nodejs', 'python', 'sql', 'rest api', 'microservices', 'docker', 'redis', 'postgresql']
}

def analyze_skill_gap(user_skills: list, target_role: str) -> dict:
    required = ROLE_SKILLS.get(target_role, ROLE_SKILLS['Software Engineer'])
    user_lower = [s.lower() for s in user_skills]
    
    matched = [s for s in required if s in user_lower]
    missing = [s for s in required if s not in user_lower]
    
    # Cosine similarity for partial matching
    all_docs = [' '.join(user_skills), ' '.join(required)]
    vectorizer = TfidfVectorizer()
    try:
        tfidf = vectorizer.fit_transform(all_docs)
        similarity = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    except:
        similarity = len(matched) / max(len(required), 1)
    
    return {
        'matched': matched,
        'missing': missing,
        'match_score': round(similarity * 100, 1),
        'exact_match_score': round(len(matched) / max(len(required), 1) * 100, 1),
        'recommendations': [f"Learn {skill}" for skill in missing[:5]]
    }

if __name__ == '__main__':
    result = analyze_skill_gap(['Python', 'SQL', 'React'], 'Data Scientist')
    print(result)