"""
skill_resources_scraper.py
~~~~~~~~~~~~~~~~~~~~~~~~~~
Scrapes required skills for a target role from live job postings, then maps
each skill to curated learning resources structured in three tiers.

KEY CHANGES:
  1. Dynamic AI fallback for niche roles (Quantum Engineer, etc.)
  2. build_phases() no longer emits a `sem` key — phases map by index to
     PhaseCard.jsx's SKILL_LEVELS array:
       index 0 = Beginner, 1 = Elementary, 2 = Intermediate,
       index 3 = Advanced,  4 = Expert,     5 = Master
"""

import argparse
import json
import os
import re
from typing import Dict, List, Optional

from web_scraper import JobScraper
from web_resource_scraper import get_real_resources


# ─────────────────────────────────────────────────────────────────────────────
#  Tiered resource catalogue
# ─────────────────────────────────────────────────────────────────────────────
TIERED_RESOURCES: Dict[str, Dict[str, List[Dict]]] = {
    "Qiskit": {
        "beginner": [
            {"title": "Qiskit Textbook – Learn Quantum Computing",  "url": "https://learning.quantum.ibm.com/"},
            {"title": "IBM Quantum Lab – free cloud circuits",       "url": "https://quantum.ibm.com/"},
            {"title": "YouTube – Qiskit channel",                   "url": "https://www.youtube.com/@qiskit"},
        ],
        "intermediate": [
            {"title": "Qiskit Algorithms module docs",             "url": "https://qiskit.org/ecosystem/algorithms/"},
            {"title": "Variational Quantum Eigensolver tutorial",  "url": "https://learning.quantum.ibm.com/tutorial/variational-quantum-eigensolver"},
            {"title": "Qiskit Runtime primitives guide",           "url": "https://docs.quantum.ibm.com/api/qiskit-ibm-runtime"},
        ],
        "advanced": [
            {"title": "Error Mitigation – IBM",                    "url": "https://learning.quantum.ibm.com/course/fundamentals-of-quantum-algorithms/quantum-error-correction"},
            {"title": "QAOA tutorial",                             "url": "https://learning.quantum.ibm.com/tutorial/quantum-approximate-optimization-algorithm"},
            {"title": "Qiskit Nature – quantum chemistry",         "url": "https://qiskit-community.github.io/qiskit-nature/"},
        ],
    },
    "Cirq": {
        "beginner": [
            {"title": "Cirq Official Docs",                        "url": "https://quantumai.google/cirq/start"},
            {"title": "Google Quantum AI tutorials",               "url": "https://quantumai.google/learn/tutorials"},
        ],
        "intermediate": [
            {"title": "Cirq noise & error models",                 "url": "https://quantumai.google/cirq/noise"},
            {"title": "OpenFermion + Cirq chemistry",              "url": "https://quantumai.google/openfermion"},
        ],
        "advanced": [
            {"title": "TensorFlow Quantum",                        "url": "https://www.tensorflow.org/quantum"},
        ],
    },
    "Quantum Mechanics": {
        "beginner": [
            {"title": "MIT OCW – 8.04 Quantum Physics I",          "url": "https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/"},
            {"title": "Quantum Country – spaced-repetition book",  "url": "https://quantum.country/"},
        ],
        "intermediate": [
            {"title": "Griffiths – Intro to Quantum Mechanics",    "url": "https://www.cambridge.org/us/universitypress/subjects/physics/quantum-physics-quantum-information-and-quantum-computation/introduction-quantum-mechanics-3rd-edition"},
            {"title": "Perimeter Institute lectures",              "url": "https://pirsa.org/"},
        ],
        "advanced": [
            {"title": "Nielsen & Chuang (10th anniversary ed.)",   "url": "https://www.cambridge.org/us/universitypress/subjects/physics/quantum-physics-quantum-information-and-quantum-computation/quantum-computation-and-quantum-information-10th-anniversary-edition"},
            {"title": "Preskill – Caltech lecture notes",          "url": "http://theory.caltech.edu/~preskill/ph229/"},
        ],
    },
    "Linear Algebra": {
        "beginner": [
            {"title": "3Blue1Brown – Essence of Linear Algebra",   "url": "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab"},
            {"title": "Khan Academy – Linear Algebra",             "url": "https://www.khanacademy.org/math/linear-algebra"},
        ],
        "intermediate": [
            {"title": "Gilbert Strang – MIT 18.06 (free)",         "url": "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/"},
            {"title": "Immersive Math – interactive textbook",     "url": "https://immersivemath.com/ila/index.html"},
        ],
        "advanced": [
            {"title": "The Matrix Cookbook",                       "url": "https://www.math.uwaterloo.ca/~hwolkowi/matrixcookbook.pdf"},
        ],
    },
    "Python": {
        "beginner": [
            {"title": "Python Official Tutorial",                  "url": "https://docs.python.org/3/tutorial/"},
            {"title": "Automate the Boring Stuff (free)",          "url": "https://automatetheboringstuff.com/"},
            {"title": "freeCodeCamp – Python for Beginners",       "url": "https://www.freecodecamp.org/learn/scientific-computing-with-python/"},
        ],
        "intermediate": [
            {"title": "Real Python tutorials",                     "url": "https://realpython.com/"},
            {"title": "Fluent Python",                             "url": "https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/"},
        ],
        "advanced": [
            {"title": "High Performance Python",                   "url": "https://www.oreilly.com/library/view/high-performance-python/9781492055013/"},
        ],
    },
    "JavaScript": {
        "beginner": [
            {"title": "JavaScript.info",                           "url": "https://javascript.info/"},
            {"title": "MDN – JavaScript Guide",                    "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"},
        ],
        "intermediate": [
            {"title": "You Don't Know JS (free)",                  "url": "https://github.com/getify/You-Dont-Know-JS"},
            {"title": "javascript30",                              "url": "https://javascript30.com/"},
        ],
        "advanced": [
            {"title": "Patterns.dev",                              "url": "https://www.patterns.dev/"},
        ],
    },
    "TypeScript": {
        "beginner": [
            {"title": "TypeScript Handbook",                       "url": "https://www.typescriptlang.org/docs/handbook/intro.html"},
            {"title": "Total TypeScript – Beginner's Tutorial",    "url": "https://www.totaltypescript.com/tutorials/beginners-typescript"},
        ],
        "intermediate": [
            {"title": "TypeScript Deep Dive (free)",               "url": "https://basarat.gitbook.io/typescript/"},
        ],
        "advanced": [
            {"title": "Total TypeScript – Advanced Patterns",      "url": "https://www.totaltypescript.com/workshops/advanced-typescript-patterns"},
        ],
    },
    "React": {
        "beginner": [
            {"title": "React Official Docs",                       "url": "https://react.dev/learn"},
            {"title": "Scrimba – Learn React for Free",            "url": "https://scrimba.com/learn/learnreact"},
        ],
        "intermediate": [
            {"title": "Epic React by Kent C. Dodds",               "url": "https://epicreact.dev/"},
        ],
        "advanced": [
            {"title": "Patterns.dev – React Patterns",             "url": "https://www.patterns.dev/react"},
        ],
    },
    "SQL": {
        "beginner": [
            {"title": "SQLZoo – interactive tutorial",             "url": "https://sqlzoo.net/"},
        ],
        "intermediate": [
            {"title": "Use The Index, Luke",                       "url": "https://use-the-index-luke.com/"},
        ],
        "advanced": [
            {"title": "CMU Database Systems (free lectures)",      "url": "https://15445.courses.cs.cmu.edu/"},
            {"title": "Designing Data-Intensive Applications",     "url": "https://dataintensive.net/"},
        ],
    },
    "Docker": {
        "beginner": [
            {"title": "Docker Official Docs",                      "url": "https://docs.docker.com/get-started/"},
            {"title": "Play with Docker (browser lab)",            "url": "https://labs.play-with-docker.com/"},
        ],
        "intermediate": [
            {"title": "Docker Compose Docs",                       "url": "https://docs.docker.com/compose/"},
        ],
        "advanced": [
            {"title": "BuildKit advanced features",                "url": "https://docs.docker.com/build/buildkit/"},
        ],
    },
    "Kubernetes": {
        "beginner":     [{"title": "Kubernetes Basics",                 "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/"}],
        "intermediate": [{"title": "Kubernetes in Action",              "url": "https://www.manning.com/books/kubernetes-in-action-second-edition"}],
        "advanced":     [{"title": "Production Kubernetes",             "url": "https://www.oreilly.com/library/view/production-kubernetes/9781492092292/"}],
    },
    "AWS": {
        "beginner":     [{"title": "AWS Cloud Practitioner Essentials", "url": "https://explore.skillbuilder.aws/learn/course/external/view/elearning/134/aws-cloud-practitioner-essentials"}],
        "intermediate": [{"title": "AWS CDK Workshop",                  "url": "https://cdkworkshop.com/"}],
        "advanced":     [{"title": "AWS re:Invent talks",               "url": "https://www.youtube.com/@AWSEventsChannel"}],
    },
    "TensorFlow": {
        "beginner":     [{"title": "TensorFlow – Learn ML",             "url": "https://www.tensorflow.org/learn"}],
        "intermediate": [{"title": "Hands-On ML with Scikit-Learn & TF","url": "https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/"}],
        "advanced":     [{"title": "TF Extended (TFX)",                 "url": "https://www.tensorflow.org/tfx"}],
    },
    "PyTorch": {
        "beginner":     [{"title": "PyTorch – Learn the Basics",        "url": "https://pytorch.org/tutorials/beginner/basics/intro.html"},
                         {"title": "fast.ai – Practical Deep Learning", "url": "https://course.fast.ai/"}],
        "intermediate": [{"title": "Deep Learning with PyTorch (free)", "url": "https://pytorch.org/assets/deep-learning/Deep-Learning-with-PyTorch.pdf"}],
        "advanced":     [{"title": "Torch.compile deep dive",           "url": "https://pytorch.org/tutorials/intermediate/torch_compile_tutorial.html"}],
    },
    "MATLAB": {
        "beginner":     [{"title": "MATLAB Onramp (free)",              "url": "https://matlabacademy.mathworks.com/details/matlab-onramp/gettingstarted"},
                         {"title": "MATLAB Documentation",              "url": "https://www.mathworks.com/help/matlab/"}],
        "intermediate": [{"title": "Signal Processing Toolbox",         "url": "https://www.mathworks.com/products/signal.html"}],
        "advanced":     [{"title": "Parallel Computing Toolbox",        "url": "https://www.mathworks.com/products/parallel-computing.html"}],
    },
    "Julia": {
        "beginner":     [{"title": "Julia Official Docs",               "url": "https://docs.julialang.org/en/v1/"},
                         {"title": "MIT Computational Thinking",        "url": "https://computationalthinking.mit.edu/"}],
        "intermediate": [{"title": "Julia for Data Science",            "url": "https://juliadatascience.io/"}],
        "advanced":     [{"title": "Performance Tips – Julia manual",   "url": "https://docs.julialang.org/en/v1/manual/performance-tips/"}],
    },
    "C++": {
        "beginner":     [{"title": "learncpp.com",                      "url": "https://www.learncpp.com/"}],
        "intermediate": [{"title": "Effective Modern C++",              "url": "https://www.oreilly.com/library/view/effective-modern-c/9781491908419/"}],
        "advanced":     [{"title": "CppCon talks",                      "url": "https://www.youtube.com/@CppCon"}],
    },
}

STATIC_FALLBACK: Dict[str, List[str]] = {
    "frontend developer":   ["JavaScript", "TypeScript", "React", "CSS", "HTML"],
    "backend developer":    ["Python", "Node", "Java", "SQL", "MongoDB", "Redis"],
    "software engineer":    ["Python", "Java", "SQL", "Docker", "Kubernetes", "AWS"],
    "data scientist":       ["Python", "Pandas", "SQL", "TensorFlow", "PyTorch"],
    "ml engineer":          ["Python", "TensorFlow", "PyTorch", "Docker", "Kubernetes"],
    "devops engineer":      ["Docker", "Kubernetes", "AWS", "Python", "SQL"],
    "quantum engineer":     ["Qiskit", "Python", "Linear Algebra", "Quantum Mechanics", "Cirq", "MATLAB"],
}


# AI fallback removed - fully dynamic web scraper only


# ─────────────────────────────────────────────────────────────────────────────
#  Resource lookup
# ─────────────────────────────────────────────────────────────────────────────

def _get_tier_resources(skill: str, tier: str, ai_res: Optional[Dict] = None, scrape_live: bool = True) -> List[Dict]:
    if skill in TIERED_RESOURCES and tier in TIERED_RESOURCES[skill]:
        return TIERED_RESOURCES[skill][tier][:3]
    for key in TIERED_RESOURCES:
        if skill.lower().startswith(key.lower()) or key.lower().startswith(skill.lower()):
            if tier in TIERED_RESOURCES[key]:
                return TIERED_RESOURCES[key][tier][:3]
    
    if scrape_live:
        print(f"[ResourceScraper] Executing LIVE web search for: {skill} ({tier})...")
        live_results = get_real_resources(skill, tier)
        if live_results:
            return live_results
        
    return [
        {"title": f"Search YouTube: {skill} {tier}", "url": f"https://www.youtube.com/results?search_query=learn+{skill.replace(' ','+')}"}
    ]


# ─────────────────────────────────────────────────────────────────────────────
#  Phase generator — NO `sem` key; phases map to SKILL_LEVELS by index
# ─────────────────────────────────────────────────────────────────────────────

def build_phases(skills: List[str], role: str, ai_resources: Optional[Dict] = None) -> List[Dict]:
    if not skills:
        return []

    def R(s, t, i):
        return _get_tier_resources(s, t, ai_resources, scrape_live=(i < 1))

    half    = max(1, len(skills) // 2)
    first_h = skills[:half]
    second_h = skills[half:] or first_h
    rc = role.title()

    return [
        # [0] Beginner
        {
            "title": "Foundations",
            "duration": "4–8 weeks",
            "description": f"Build the theoretical and practical base for {rc}. Core concepts, environment setup, first programs.",
            "tasks": first_h,
            "resources": [{"skill": s, "tier": "beginner", "resources": R(s, "beginner", i)} for i, s in enumerate(first_h)],
        },
        # [1] Elementary
        {
            "title": "Core Tooling",
            "duration": "4–8 weeks",
            "description": f"Expand your {rc} toolkit. Apply foundational knowledge to realistic exercises.",
            "tasks": second_h,
            "resources": [{"skill": s, "tier": "beginner", "resources": R(s, "beginner", i)} for i, s in enumerate(second_h)],
        },
        # [2] Intermediate
        {
            "title": "Intermediate Skills",
            "duration": "8–12 weeks",
            "description": f"Libraries, frameworks, and architectural patterns used by professional {rc}s.",
            "tasks": skills,
            "resources": [{"skill": s, "tier": "intermediate", "resources": R(s, "intermediate", i)} for i, s in enumerate(skills)],
        },
        # [3] Advanced
        {
            "title": "Advanced Mastery",
            "duration": "8–12 weeks",
            "description": f"Performance, scalability, research papers, and advanced architectures for {rc}.",
            "tasks": skills,
            "resources": [{"skill": s, "tier": "advanced", "resources": R(s, "advanced", i)} for i, s in enumerate(skills)],
        },
        # [4] Expert
        {
            "title": "Capstone Projects",
            "duration": "4–8 weeks",
            "description": f"2–3 portfolio-quality {rc} projects with tests, deployment and docs.",
            "tasks": [
                f"Build a portfolio project combining {', '.join(skills[:3])}",
                "Write unit + integration tests",
                "Deploy your project (cloud / HuggingFace Spaces)",
                "Write a technical README with architecture diagram",
                "Contribute to a relevant open-source repository",
            ],
            "resources": [
                {"skill": "Project Planning", "tier": "advanced", "resources": [
                    {"title": "GitHub Explore",   "url": "https://github.com/explore"},
                    {"title": "roadmap.sh",       "url": "https://roadmap.sh/"},
                ]},
                {"skill": "Testing", "tier": "intermediate", "resources": [
                    {"title": "pytest docs",      "url": "https://docs.pytest.org/"},
                    {"title": "Testing Library",  "url": "https://testing-library.com/"},
                ]},
                {"skill": "Deployment", "tier": "intermediate", "resources": [
                    {"title": "Vercel Docs",      "url": "https://vercel.com/docs"},
                    {"title": "HuggingFace Spaces","url": "https://huggingface.co/spaces"},
                ]},
                {"skill": "Documentation", "tier": "beginner", "resources": [
                    {"title": "makeareadme.com",  "url": "https://www.makeareadme.com/"},
                ]},
                {"skill": "Open Source", "tier": "advanced", "resources": [
                    {"title": "First Contributions","url": "https://firstcontributions.github.io/"},
                    {"title": "Good First Issues", "url": "https://goodfirstissues.com/"},
                ]},
            ],
        },
        # [5] Master
        {
            "title": "Interview Preparation",
            "duration": "4–6 weeks",
            "description": f"Land the {rc} job. Algorithms, system/domain design, and behavioural interviews.",
            "tasks": [
                f"Domain-specific problem solving for {rc} roles",
                "Data structures & algorithms (arrays, trees, graphs, DP)",
                "LeetCode – Blind 75 problems",
                "System / domain design interviews",
                "Behavioural questions (STAR method)",
                "Mock interviews (Pramp / Interviewing.io)",
            ],
            "resources": [
                {"skill": "DSA", "tier": "intermediate", "resources": [
                    {"title": "NeetCode 150",      "url": "https://neetcode.io/practice"},
                    {"title": "LeetCode",          "url": "https://leetcode.com/"},
                ]},
                {"skill": "Domain Problems", "tier": "advanced", "resources": [
                    {"title": f"{rc} questions – Glassdoor",
                     "url": f"https://www.glassdoor.com/Interview/{role.replace(' ','-')}-interview-questions-SRCH_KO0,{len(role)}.htm"},
                    {"title": "Striver's A2Z DSA", "url": "https://takeuforward.org/strivers-a2z-dsa-course/"},
                ]},
                {"skill": "System Design", "tier": "advanced", "resources": [
                    {"title": "System Design Primer","url": "https://github.com/donnemartin/system-design-primer"},
                    {"title": "Grokking System Design","url": "https://www.designgurus.io/course/grokking-the-system-design-interview"},
                ]},
                {"skill": "Mock Interviews", "tier": "advanced", "resources": [
                    {"title": "Pramp",             "url": "https://www.pramp.com/"},
                    {"title": "Interviewing.io",   "url": "https://interviewing.io/"},
                ]},
            ],
        },
    ]


# ─────────────────────────────────────────────────────────────────────────────
#  Main scraper class
# ─────────────────────────────────────────────────────────────────────────────

class SkillResourcesScraper:
    def __init__(self):
        self.job_scraper = JobScraper()

    def get_dynamic_role_resources(self, target_role: str, location: str = "India", num_jobs: int = 5) -> Dict:
        print(f"[Scraper] Starting pipeline for '{target_role}'…")
        extracted_skills = self.job_scraper.scrape_job_skills(target_role, location, num_jobs)

        if len(extracted_skills) < 3:
            key = target_role.lower().strip()
            # If our real job scraper fails, fallback to hardcoded domain basics, no LLMs.
            from fast_scraper import _domain
            extracted_skills = _domain(target_role)

        phases = build_phases(extracted_skills, target_role, None)
        return {
            "role":             target_role,
            "location":         location,
            "extracted_skills": extracted_skills,
            "phases":           phases,
            "source":           "live-scrape",
        }


# ─────────────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--role",     default="Quantum Engineer")
    parser.add_argument("--location", default="India")
    parser.add_argument("--num-jobs", type=int, default=5)
    parser.add_argument("--json",     action="store_true")
    args    = parser.parse_args()
    scraper = SkillResourcesScraper()
    result  = scraper.get_dynamic_role_resources(args.role, args.location, args.num_jobs)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        LEVELS = ["Beginner","Elementary","Intermediate","Advanced","Expert","Master"]
        print(f"\nRole:   {result['role']}")
        print(f"Source: {result['source']}")
        print(f"Skills: {', '.join(result['extracted_skills'])}")
        for i, p in enumerate(result["phases"]):
            print(f"  [{LEVELS[min(i,5)]}] {p['title']} ({p.get('duration','?')}): {len(p['tasks'])} tasks")

if __name__ == "__main__":
    main()