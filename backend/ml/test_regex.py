import re

results = [
    "1", "22MTC04", "Differential Equations & Numerical Methods", "4.00", "S", "40.00", "P",
    "2", "22CYC01", "Chemistry", "3.00", "S", "30.00", "P",
    "3", "22EEC01", "Basic Electrical Engineering", "3.00", "A", "27.00", "P",
    "10", "22ACT01", "Activity Points *", "--", "-", "32", "--"
]

full_text = " ".join(results)
print("Full text:", full_text)

subjects = []
pattern = r'\b([A-Z]{2}\d{2,3}|\d{2}[A-Z]{2,4}\d{2})\b'
grade_pattern = r'\b(O|A\+|A|B\+|B|C|S|P|F)\b'

matches = list(re.finditer(pattern, full_text, re.IGNORECASE))
for idx, match in enumerate(matches):
    start = match.end()
    end = matches[idx+1].start() if idx + 1 < len(matches) else len(full_text)
    segment = full_text[start:end].strip()
    
    m = re.search(rf'(.*?)\s+(\d+\.\d+|\d)\s+{grade_pattern}', segment, re.IGNORECASE)
    if m:
        raw_name = m.group(1)
        credits = int(float(m.group(2)))
        grade = m.group(3).upper()
        
        name = re.sub(r'[^a-zA-Z\s&,-]', ' ', raw_name).strip()
        name = re.sub(r'\s+', ' ', name)
        
        if len(name) > 3:
            subjects.append({
                "name": name,
                "credits": credits,
                "grade": grade
            })
            
print(subjects)
