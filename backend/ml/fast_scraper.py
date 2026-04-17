import re, requests
from bs4 import BeautifulSoup
from typing import List, Dict
from urllib.parse import quote_plus

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"}

SKILL_RE = re.compile(r"\b(python|java|javascript|typescript|golang|rust|kotlin|swift|php|ruby|scala|sql|bash|react|angular|vue|node\.js|django|flask|fastapi|spring|tensorflow|pytorch|scikit-learn|pandas|numpy|aws|gcp|azure|docker|kubernetes|terraform|linux|git|machine learning|deep learning|nlp|data science|spark|kafka|tableau|power bi|mongodb|postgresql|mysql|redis|elasticsearch|agile|scrum|rest api|graphql|microservices|system design|figma|patient care|clinical|anatomy|pharmacology|bls|acls|icu|ehr|triage|wound care|critical care|nursing|mathematics|physics|chemistry|biology|reasoning|quantitative aptitude|general knowledge|ethics|economics|history|geography|communication|leadership|excel)\b", re.IGNORECASE)

DOMAIN: Dict[str, List[str]] = {
    "software engineer":     ["Python","Java","Data Structures","Algorithms","System Design","Git","SQL","REST API","Docker","Testing"],
    "data scientist":        ["Python","Machine Learning","SQL","Statistics","Pandas","TensorFlow","Tableau","Deep Learning","NLP"],
    "ml engineer":           ["Python","PyTorch","MLOps","Docker","Kubernetes","Statistics","NLP","LLM","TensorFlow"],
    "devops engineer":       ["Docker","Kubernetes","CI/CD","AWS","Terraform","Linux","Jenkins","Git","Ansible","Monitoring"],
    "frontend developer":    ["React","TypeScript","CSS","HTML","Figma","Testing","Next.js","Vue","JavaScript","Webpack"],
    "backend developer":     ["Node.js","Python","SQL","REST API","Docker","Redis","Microservices","Java","System Design"],
    "full stack developer":  ["React","Node.js","MongoDB","TypeScript","Docker","SQL","Git","REST API","System Design"],
    "product manager":       ["Agile","Scrum","Data Analysis","Communication","Roadmapping","SQL","Figma","User Research"],
    "cybersecurity analyst": ["Networking","Linux","Python","Penetration Testing","SIEM","Cryptography","Firewall","SOC","OWASP"],
    "cloud engineer":        ["AWS","GCP","Azure","Terraform","Kubernetes","Linux","CI/CD","Docker","Networking"],
    "data engineer":         ["Python","Spark","Kafka","Airflow","SQL","dbt","Snowflake","BigQuery","ETL"],
    "android developer":     ["Kotlin","Java","Android SDK","Jetpack Compose","Firebase","REST API","Git","Testing"],
    "ios developer":         ["Swift","Xcode","UIKit","SwiftUI","Core Data","REST API","Git","Testing"],
    "ui/ux designer":        ["Figma","User Research","Prototyping","Adobe XD","Usability Testing","Wireframing","Sketch","CSS"],
    "data analyst":          ["SQL","Python","Excel","Tableau","Power BI","Statistics","Data Visualization","R"],
    "business analyst":      ["SQL","Excel","Data Analysis","Communication","Agile","Tableau","JIRA","Power BI"],
    "financial analyst":     ["Excel","Financial Modeling","SQL","Statistics","Python","Accounting","Valuation","Bloomberg"],
    "nurse":                 ["Patient Care","Clinical Skills","Anatomy","Pharmacology","BLS","ACLS","ICU","EMR","Wound Care","Triage","IV Therapy","Critical Care","Nursing Assessment","Medication Administration"],
    "doctor":                ["Clinical Diagnosis","Pharmacology","Anatomy","Physiology","Patient Care","Medical Ethics","BLS","ACLS","EMR","Surgery Basics","Differential Diagnosis"],
    "dentist":               ["Oral Surgery","Radiology","Patient Care","Dental Anatomy","BLS","Orthodontics","Restorative Dentistry"],
    "pharmacist":            ["Pharmacology","Drug Interactions","Dispensing","Patient Counseling","Medication Management","Clinical Pharmacy"],
    "physiotherapist":       ["Anatomy","Biomechanics","Exercise Therapy","Patient Assessment","Rehabilitation","Electrotherapy"],
    "upsc":                  ["History","Geography","Economics","Public Administration","Current Affairs","Ethics","Essay Writing","General Knowledge","Polity","Environment"],
    "upsc cse":              ["History","Geography","Economics","Public Administration","Current Affairs","Ethics","Essay Writing","General Knowledge"],
    "jee":                   ["Mathematics","Physics","Chemistry","Problem Solving","Calculus","Mechanics","Organic Chemistry","Inorganic Chemistry"],
    "neet":                  ["Biology","Physics","Chemistry","Anatomy","Physiology","Organic Chemistry","Genetics","Ecology"],
    "cat":                   ["Quantitative Aptitude","Verbal Reasoning","Data Interpretation","Logical Reasoning","Reading Comprehension"],
    "gate":                  ["Mathematics","Core Engineering","Data Structures","Algorithms","Subject Specialization"],
    "gre":                   ["Verbal Reasoning","Quantitative Reasoning","Analytical Writing","Vocabulary","Mathematics"],
    "ielts":                 ["Reading","Writing","Listening","Speaking","English Grammar","Vocabulary"],
    "bank po":               ["Quantitative Aptitude","English","Reasoning","General Awareness","Computer Knowledge"],
    "ssc cgl":               ["Quantitative Aptitude","English","Reasoning","General Knowledge","Mathematics"],
    "lawyer":                ["Legal Research","Contract Drafting","Court Procedure","Communication","Constitutional Law","Negotiation","Ethics","Indian Penal Code"],
    "mechanical engineer":   ["CAD","SolidWorks","AutoCAD","Thermodynamics","Fluid Mechanics","Manufacturing","ANSYS","Matlab"],
    "civil engineer":        ["AutoCAD","STAAD Pro","Structural Analysis","Construction Management","Surveying","Soil Mechanics"],
    "electrical engineer":   ["Circuit Design","MATLAB","PLC","Power Systems","Embedded Systems","Control Systems","AutoCAD"],
    "graphic designer":      ["Photoshop","Illustrator","Typography","Color Theory","Figma","Branding","Canva","InDesign"],
    "content writer":        ["SEO Writing","Research","Grammar","Copywriting","CMS","WordPress","Social Media"],
    "chartered accountant":  ["Accounting","Taxation","Auditing","Financial Reporting","Excel","IFRS","GST","Tally"],
    "hr manager":            ["Recruitment","Excel","Communication","Employment Law","Performance Management","HRMS","Training"],
    "marketing manager":     ["Digital Marketing","SEO","Google Ads","Social Media","Data Analysis","CRM","Excel","Content Marketing"],
    "investment banker":     ["Financial Modeling","Valuation","Excel","M&A","DCF Analysis","Bloomberg","Communication","Python"],
    "blockchain developer":  ["Solidity","Ethereum","Web3","Smart Contracts","JavaScript","Rust","Cryptography","Hardhat"],
    "game developer":        ["Unity","C#","Unreal Engine","C++","Game Physics","3D Modeling","OpenGL","Blender"],
    "cybersecurity":         ["Networking","Linux","Python","Penetration Testing","SIEM","Cryptography","Firewall","SOC","OWASP"],
}

def _extract(text: str) -> List[str]:
    seen, out = set(), []
    for m in SKILL_RE.findall(text):
        k = m.lower()
        if k not in seen:
            seen.add(k); out.append(m.title())
    return out

def _domain(role: str) -> List[str]:
    r = role.lower().strip()
    if r in DOMAIN: return DOMAIN[r]
    for k, v in DOMAIN.items():
        if k in r or r in k: return v
    for k, v in DOMAIN.items():
        if any(w in r for w in k.split()): return v
    return ["Problem Solving","Communication","Research Skills","Data Analysis","Time Management","Analytical Thinking"]

def _remoteok(role: str) -> List[str]:
    try:
        tag = role.split()[0].lower()
        r = requests.get(f"https://remoteok.com/api?tag={quote_plus(tag)}", headers={**HEADERS,"Accept":"application/json"}, timeout=6)
        if r.status_code == 200:
            jobs = r.json()
            if isinstance(jobs, list) and len(jobs) > 1:
                text = " ".join(str(j.get("tags",""))+" "+str(j.get("description","")) for j in jobs[1:8])
                return _extract(text)
    except: pass
    return []

class FastJobScraper:
    def scrape_job_skills(self, role: str, num_jobs: int = 8) -> List[str]:
        print(f"[FastScraper] role={role}")
        skills = _remoteok(role)
        print(f"[FastScraper] live={len(skills)}")
        fallback = _domain(role)
        for f in fallback:
            if f.lower() not in [s.lower() for s in skills]:
                skills.append(f)
        seen, out = set(), []
        for s in skills:
            if s.lower() not in seen:
                seen.add(s.lower()); out.append(s)
        print(f"[FastScraper] total={len(out)}")
        return out[:30]
