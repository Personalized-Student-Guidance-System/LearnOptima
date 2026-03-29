import requests
from bs4 import BeautifulSoup
import re
import json
from urllib.parse import urljoin, urlparse
import time

class JobScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def scrape_job_skills(self, job_title, location='India', num_jobs=5):
        """
        Scrape required skills for a job title from multiple sites
        Returns: list of common skills
        """
        sites = {
            'naukri': self._scrape_naukri(job_title, location, num_jobs),
            'linkedin': self._scrape_linkedin(job_title, location, num_jobs),
            'indeed': self._scrape_indeed(job_title, location, num_jobs)
        }
        
        all_skills = []
        for site, skills in sites.items():
            all_skills.extend(skills or [])
        
        # Dedupe and rank by frequency
        skill_count = {}
        for skill in all_skills:
            skill_lower = skill.strip().lower()
            skill_count[skill_lower] = skill_count.get(skill_lower, 0) + 1
        
        # Top 20 skills sorted by frequency
        top_skills = sorted(skill_count.items(), key=lambda x: x[1], reverse=True)[:20]
        return [skill for skill, count in top_skills]
    
    def _scrape_naukri(self, job_title, location, num_jobs):
        try:
            url = f"https://www.naukri.com/{job_title.replace(' ', '-')}-jobs-in-{location}"
            response = self.session.get(url, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            skills = []
            job_cards = soup.find_all('div', class_=re.compile(r'jobTuple|joblist'))
            for card in job_cards[:num_jobs]:
                skill_tags = card.find_all('span', class_=re.compile(r'skill|tag'))
                for tag in skill_tags:
                    skills.append(tag.get_text(strip=True))
            return list(set(skills))
        except:
            return []
    
    def _scrape_linkedin(self, job_title, location, num_jobs):
        try:
            # LinkedIn requires specific search URL
            url = f"https://www.linkedin.com/jobs/search?keywords={job_title}&location={location}"
            response = self.session.get(url, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            skills = []
            job_cards = soup.find_all('div', class_=re.compile(r'job-search-card'))
            for card in job_cards[:num_jobs]:
                skill_text = card.get_text()
                # Extract common skills from text
                skill_matches = re.findall(r'\b(Python|Java|React|Node\.?js?|JavaScript|SQL|Docker|AWS|Kubernetes|Machine Learning|ML|Data Science|React Native|Angular|Vue\.?js?|MongoDB|PostgreSQL|Git|Linux|Windows|Excel|Power BI|Tableau)\b', skill_text, re.I)
                skills.extend(skill_matches)
            return list(set(skills))
        except:
            return []
    
    def _scrape_indeed(self, job_title, location, num_jobs):
        try:
            url = f"https://in.indeed.com/jobs?q={job_title}&l={location}"
            response = self.session.get(url, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            skills = []
            job_cards = soup.find_all('div', class_=re.compile(r'job_seen_beacon|jobResult'))
            for card in job_cards[:num_jobs]:
                skill_text = card.get_text()
                skill_matches = re.findall(r'\b(Python|Java|React|Node\.?js?|JavaScript|SQL|Docker|AWS|Kubernetes|Machine Learning|ML|Data Science|React Native|Angular|Vue\.?js?|MongoDB|PostgreSQL|Git|Linux|Windows|Excel|Power BI|Tableau)\b', skill_text, re.I)
                skills.extend(skill_matches)
            return list(set(skills))
        except:
            return []

if __name__ == '__main__':
    scraper = JobScraper()
    skills = scraper.scrape_job_skills('Software Engineer')
    print(json.dumps({'skills': skills}, indent=2))

