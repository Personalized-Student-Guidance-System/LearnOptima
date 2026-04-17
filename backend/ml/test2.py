import re

def parse_text(raw_text):
    subjects = []
    
    # Common Grade Patterns
    grade_pattern = r'\b(O|A\+|A|B\+|B|C|D|E|S|P|F|A\*|B\*|C\*)\b'
    # Extended Course Code Pattern
    code_pattern = r'\b([A-Z]{2,4}\s?\d{2,4}|\d{2,4}[A-Z]{2,4}\d{2,4})\b'
    
    # Try Heuristic 1: Based on Course Codes
    matches = list(re.finditer(code_pattern, raw_text, re.IGNORECASE))
    print(f"Course code matches: {len(matches)}")
    
    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx+1].start() if idx + 1 < len(matches) else len(raw_text)
        segment = raw_text[start:end].strip()
        
        # Look for Subject Name, Credits, Grade
        # Name might be followed by credits and grade, or grade and credits
        m = re.search(rf'(.*?)\s+(\d+(?:\.\d+)?)\s+{grade_pattern}', segment, re.IGNORECASE)
        if not m:
            m = re.search(rf'(.*?)\s+{grade_pattern}\s+(\d+(?:\.\d+)?)', segment, re.IGNORECASE)
            
        if m:
            # We found it!
            raw_name = m.group(1)
            try:
                credits_val = m.group(2) if re.match(r'\d+(?:\.\d+)?', m.group(2)) else m.group(3)
                grade_val = m.group(3) if re.match(grade_pattern, m.group(3), re.IGNORECASE) else m.group(2)
                
                credits = int(float(credits_val))
                grade = grade_val.upper()
                name = re.sub(r'[^a-zA-Z\s&,-]', ' ', raw_name).strip()
                name = re.sub(r'\s+', ' ', name)
                
                if len(name) > 3:
                    subjects.append({
                        "name": name,
                        "credits": credits,
                        "grade": grade
                    })
            except Exception as e:
                pass

    if len(subjects) == 0:
        print("Heuristic 1 failed. Trying Heuristic 2.")
        # Try Heuristic 2: Sliding Window or Direct Regex over raw_text without codes
        # Assuming format: Subject Name (letters and spaces) followed by Credits (number) and Grade
        h2_pattern = rf'([A-Za-z\s&,-]{{5,50}}?)\s+(\d+(?:\.\d+)?)\s+{grade_pattern}'
        for m in re.finditer(h2_pattern, raw_text, re.IGNORECASE):
            raw_name, credits_val, grade_val = m.groups()
            credits = int(float(credits_val))
            grade = grade_val.upper()
            
            name = raw_name.strip()
            name = re.sub(r'\s+', ' ', name)
            
            # Simple heuristic strictly refusing names that look like generic column headers
            if len(name) > 3 and name.lower() not in ['course name', 'subject title', 'subject name']:
                subjects.append({
                    "name": name,
                    "credits": credits,
                    "grade": grade
                })

    return subjects

text1 = "1 22MTC04 Differential Equations & Numerical Methods 4.00 S 40.00 P 2 22CYC01 Chemistry 3.00 S 30.00 P 3 22EEC01 Basic Electrical Engineering 3.00 A 27.00 P"
text2 = "Data Structures and Algorithms 4 A Operating Systems 3 B+ Machine Learning 4 O"

print("Test 1:", parse_text(text1))
print("Test 2:", parse_text(text2))

