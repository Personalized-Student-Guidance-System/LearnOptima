import os
import sys
import requests
import re
from typing import Dict, List, Optional, Tuple

ONET_BASE = "https://api-v2.onetcenter.org/online"

class OnetClient:
    """
    O*NET Web Services client.
    Uses API Key authentication.
    """
    
    # Modern tech roles mapping to standard O*NET occupations
    TECH_ROLE_MAPPINGS = {
        "devops": "15-1252.00", # Software Developers
        "sre": "15-1252.00",
        "platform": "15-1252.00",
        "ml engineer": "15-1252.00",
        "machine learning": "15-1252.00",
        "data scientist": "15-2051.00", # Data Scientists
        "data engineer": "15-1243.00", # Database Architects
        "cloud engineer": "15-1211.00", # Computer Systems Analysts
        "frontend": "15-1252.00",
        "backend": "15-1252.00",
        "full stack": "15-1252.00",
        "software engineer": "15-1252.00",
        "software developer": "15-1252.00",
        "quantum": "17-2199.09", # Nanosystems Engineers (Closest for Quantum Hardware/Eng)
        "cybersecurity": "15-1212.00", # Information Security Analysts
        "security engineer": "15-1212.00",
        "ux designer": "15-1255.00", # Web Developers and Digital Interface Designers
    }

    def __init__(self):
        # Check ONET_API_KEY or ONET_PASSWORD (legacy fallback)
        self.api_key = os.environ.get("ONET_API_KEY", os.environ.get("ONET_PASSWORD", "")).strip()
        self.available = bool(self.api_key)
        if not self.available:
            print("[O*NET] ONET_API_KEY not set — will skip O*NET", file=sys.stderr)
        else:
            print("[O*NET] ✓ API Key found. Ready to search.", file=sys.stderr)

    def _get(self, path: str, params: Dict = None) -> Optional[Dict]:
        if not self.available:
            return None
        try:
            url = f"{ONET_BASE}/{path}"
            headers = {
                "Accept": "application/json",
                "X-API-Key": self.api_key
            }
            r = requests.get(
                url,
                params=params or {},
                headers=headers,
                timeout=12,
            )
            if r.status_code == 200:
                return r.json()
                
            print(f"[O*NET] HTTP {r.status_code} for {path}")
        except Exception as e:
            print(f"[O*NET] Request error: {e}")
        return None

    def _clean_role(self, role: str) -> str:
        """Sanitize messy role strings (e.g. from job boards with + separators)."""
        if not role:
            return ""
        
        # 1. Split by common separators and take the first meaningful segment
        segments = re.split(r'[+\|,;]', role)
        clean = ""
        for seg in segments:
            s = seg.strip()
            # Avoid segments that look like company names if possible, 
            # or just take the first one that has more than 3 chars
            if len(s) > 3:
                clean = s
                break
        
        if not clean:
            clean = role.strip()

        # 2. Basic cleanup (remove redundant whitespace, common company suffixes)
        clean = re.sub(r'\s+', ' ', clean)
        clean = re.sub(r'\b(ltd|pvt|private|limited|inc|corp|corporation|group|capital|energy|ports|steel)\b\.?', '', clean, flags=re.I).strip()
        
        # 3. If everything was removed, fallback to the first segment
        if not clean and segments:
            clean = segments[0].strip()
            
        print(f"[O*NET] Cleaning role: '{role}' -> '{clean}'")
        return clean

    def search_occupation(self, role: str) -> Optional[Tuple[str, str]]:
        """Find best-matching O*NET occupation code + title for a role."""
        cleaned_role = self._clean_role(role).lower()
        
        # Priority 0: Hardcoded Tech Mappings
        for tech_key, code in self.TECH_ROLE_MAPPINGS.items():
            if tech_key in cleaned_role:
                # Return standard O*NET title for the code if found later, or just name it
                print(f"[O*NET] Tech Mapping Hit: '{role}' -> '{tech_key}' ({code})")
                return code, cleaned_role.title()

        data = self._get("search", {"keyword": cleaned_role, "end": 5})
        if not data:
            # Fallback to searching without cleaning if no results
            if cleaned_role != role.strip():
                data = self._get("search", {"keyword": role.strip()[:100], "end": 5})
            
        if not data:
            return None
        
        occupations = data.get("occupation", [])
        if not occupations:
            return None
        
        # Smart selection: find the result with best word overlap to avoid generic traps
        # (e.g. "Police" matching "Secretaries" first)
        best_occ = occupations[0]
        max_overlap = -1
        
        role_words = set(cleaned_role.lower().split())
        
        for occ in occupations[:5]:
            title = occ.get("title", "").lower()
            
            # Count how many role words or their components are in the O*NET title
            overlap = 0
            for rw in role_words:
                if rw in title:
                    overlap += 2
                elif any(rw[:4] in part for part in title.split()): # check for substrings like 'poli' in 'police'
                    overlap += 1
            
            # Boost if it's a manager/supervisor/head and the input has those keywords
            manager_keywords = ["manager", "supervisor", "chief", "head", "director", "officer", "analyst"]
            if any(w in title for w in manager_keywords) and \
               any(w in cleaned_role.lower() for w in manager_keywords):
                overlap += 1
            
            # Penalize the "Secretaries" trap if the input doesn't mention secretaries
            if "secretary" in title and "secretary" not in cleaned_role.lower():
                overlap -= 5

            if overlap > max_overlap:
                max_overlap = overlap
                best_occ = occ
        
        code  = best_occ.get("code", "")
        title = best_occ.get("title", "")
        print(f"[O*NET] Best Match: '{role}' -> '{title}' ({code}) [overlap={max_overlap}]")
        return code, title

    def get_skills(self, onet_code: str) -> List[Dict]:
        """Fetch skills for an occupation code with importance-based difficulty."""
        data = self._get(f"occupations/{onet_code}/summary/skills")
        if not data:
            return []
        skills_raw = data.get("element", [])
        skills: List[Dict] = []
        for item in skills_raw[:15]:
            name  = item.get("name", "").strip()
            score = float(item.get("score", {}).get("value", 3.0))
            if not name:
                continue
            if score <= 2.5:
                level = "beginner"
            elif score <= 3.75:
                level = "intermediate"
            else:
                level = "advanced"
            skills.append({"name": name, "level": level, "score": score})
        return skills

    def get_knowledge(self, onet_code: str) -> List[Dict]:
        """Fetch knowledge areas for an occupation."""
        data = self._get(f"occupations/{onet_code}/summary/knowledge")
        if not data:
            return []
        items = data.get("element", [])
        knowledge: List[Dict] = []
        for item in items[:8]:
            name  = item.get("name", "").strip()
            score = float(item.get("score", {}).get("value", 3.0))
            if not name:
                continue
            level = "beginner" if score <= 2.5 else ("advanced" if score > 3.75 else "intermediate")
            knowledge.append({"name": name, "level": level, "score": score})
        return knowledge

    def get_abilities(self, onet_code: str) -> List[Dict]:
        """Fetch abilities."""
        data = self._get(f"occupations/{onet_code}/summary/abilities")
        if not data:
            return []
        items = data.get("element", [])
        abilities: List[Dict] = []
        for item in items[:6]:
            name  = item.get("name", "").strip()
            score = float(item.get("score", {}).get("value", 3.0))
            if not name:
                continue
            level = "beginner" if score <= 2.5 else ("advanced" if score > 3.75 else "intermediate")
            abilities.append({"name": name, "level": level, "score": score})
        return abilities

    def get_technology_skills(self, onet_code: str, role: str = "") -> List[Dict]:
        """Fetch modern technology skills/tools."""
        data = self._get(f"occupations/{onet_code}/details/technology_skills")
        if not data:
            return []
        
        tech_skills = []
        # Noisy tools that O*NET includes but should be removed from tech roadmaps
        HARD_FILTER = [
            "atlassian confluence", "microsoft teams", "microsoft office", 
            "microsoft sharepoint", "apple ios", "microsoft powerpoint", 
             "microsoft outlook", "microsoft exchange",
            "slack", "zoom", "skype", "adobe acrobat", "google drive", 
            "google docs", "spreadsheets", "presentation software", "email software"
        ]
        
        # Add Excel to hard filter ONLY for technical engineers (keep for accountants)
        if any(kw in role.lower() for kw in ["engineer", "developer", "scientist", "quantum"]):
            HARD_FILTER.append("microsoft excel")
        
        # If explicitly Chartered Accountant, filter out US-centric tools like QuickBooks if user requested
        if "chartered" in role.lower() or "accountant" in role.lower():
            HARD_FILTER.append("intuit quickbooks")
            HARD_FILTER.append("sage")

        # Flatten the nested structure (category -> example)
        for cat in data.get("category", []):
            for ex in cat.get("example", [])[:20]:
                name = ex.get("title", "").strip()
                if not name:
                    continue
                
                # Hard Filter
                if any(hf in name.lower() for hf in HARD_FILTER):
                    continue

                # Map Hot Technologies to a high score
                is_hot = ex.get("hot_technology") == True
                is_demand = ex.get("in_demand") == True
                score = 5.0 if is_hot else (4.0 if is_demand else 3.5)
                level = "advanced" if is_hot else "intermediate"
                
                # Capture the category heading (e.g., "Analytical or scientific software")
                if isinstance(cat, dict):
                    cat_title = cat.get("title", {})
                    # Some O*NET versions use a dict for title, others a string
                    if isinstance(cat_title, dict):
                        cat_name = cat_title.get("name", "Other Software")
                    else:
                        cat_name = str(cat_title)
                else:
                    cat_name = str(cat)
                
                # Strip the O*NET "—" if present
                cat_name = cat_name.split("—")[0].strip()
                
                tech_skills.append({
                    "name": name, 
                    "level": level, 
                    "score": score, 
                    "type": "tech",
                    "category": cat_name
                })
        
        return tech_skills

    def get_role_skills(self, role: str) -> List[Dict]:
        """Full pipeline: role name → O*NET code → skills + knowledge + abilities."""
        result = self.search_occupation(role)
        if not result:
            return []
        code, _title = result

        # Fetch all components
        tech      = self.get_technology_skills(code, role=role)
        skills    = self.get_skills(code)
        knowledge = self.get_knowledge(code)
        abilities = self.get_abilities(code)

        # Merge and deduplicate, prioritizing TECH first
        seen = set()
        merged = []
        
        # 1. Tech skills first (the tool stack)
        for s in tech:
            key = s["name"].lower()
            if key not in seen:
                # Downrank basic office software for advanced tech roles
                basic_office = ["powerpoint", "word", "outlook", "excel", "spreadsheets", "office suite"]
                if any(bo in key for bo in basic_office):
                    if any(tw in role.lower() for tw in ["engineer", "developer", "scientist", "quantum", "data"]):
                        # Give it a very low score so it goes to bottom
                        s["score"] = 1.0
                        s["level"] = "beginner"
                
                seen.add(key)
                merged.append(s)
        
        # Sort tech skills by score (to move office tools down)
        merged.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        # 2. Add other competencies
        for s in skills + knowledge + abilities:
            key = s["name"].lower()
            if key not in seen:
                # Filter out obvious filler for tech roles
                tech_keywords = ["devops", "software", "web", "data", "cloud", "ml", "system", "analyst"]
                if any(tw in role.lower() for tw in tech_keywords):
                    # Blacklist generic academic/administrative skills for tech roles
                    blacklist = [
                        "physics", "science", "chemistry", "biology", "geography", 
                        "english", "mathematics", "public safety", "clerical",
                        "personal service", "psychology", "sociology", "law and government",
                        "education and training", "therapy", "medicine", "history",
                        "philosophy", "fine arts", "sales and marketing", "economics",
                        "accounting", "human resources", "writing", "reading comprehension",
                        "active listening", "speaking", "critical thinking", "complex problem solving",
                        "monitoring", "judgment and decision making", "active learning"
                    ]
                    if any(b in key for b in blacklist):
                        continue
                
                seen.add(key)
                merged.append(s)

        print(f"[O*NET] Got {len(merged)} skills for '{role}' ({code})")
        return merged[:20]
