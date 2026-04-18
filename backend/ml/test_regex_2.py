import re

text = "22MTC04 Dlferentlal Equations Numerical Methods 40.00 22CYC01 Chemistry 30.,00 22EECO1 Basic Electrical Engineering 3.00 30.00 22CSC03 Object Oriented Programming 3.00 27.00 22CYC02 Chemistry Lab 1.50 15,00"

text_clean = re.sub(r'\s*\(\s*[P|F|p|f]\s*\)\s*', ' ', text)
subjects = []
grade_pattern = r'\b(O|A\+|A|B\+|B|C|D|E|S|P|F|A\*|B\*|C\*|\w\+)\b'

code_starts = list(re.finditer(r'\b([0-9O]{2}[A-Z]{3,4}[0-9O]{2,3})\b', text_clean))
print(f"Found {len(code_starts)} codes")
for idx, match in enumerate(code_starts):
    code = match.group(1)
    start = match.end()
    end = code_starts[idx+1].start() if idx + 1 < len(code_starts) else len(text_clean)
    part = text_clean[start:end].strip()
    
    numbers = re.findall(r'\b\d+(?:\.\d+)?\b', part)
    
    name = re.sub(grade_pattern, ' ', part, flags=re.I)
    name = re.sub(r'\b\d+(?:\.\d+)?\b', ' ', name)
    name = re.sub(r'[^a-zA-Z\s\-]', ' ', name).strip()
    name = re.sub(r'\s+', ' ', name)
    
    credits_val = 3
    grade_val = 'P'
    
    if numbers:
        num_f = [float(n) for n in numbers]
        if len(num_f) >= 2:
            if 1 <= num_f[0] <= 10:
                credits_val = num_f[0]
                points = num_f[1]
                if points > 0:
                    score = round(points / credits_val)
                    if score >= 10: grade_val = 'S'
                    elif score >= 9: grade_val = 'A'
                    elif score >= 8: grade_val = 'B'
                    elif score >= 7: grade_val = 'C'
                    elif score >= 6: grade_val = 'D'
        elif len(num_f) == 1:
            if num_f[0] > 10:
                if num_f[0] >= 40: credits_val = 4; grade_val = 'S'
                elif num_f[0] >= 30: credits_val = 3; grade_val = 'S'
                elif num_f[0] >= 20: credits_val = 2; grade_val = 'S'
                elif num_f[0] >= 15: credits_val = 1.5; grade_val = 'S'
                elif num_f[0] >= 10: credits_val = 1; grade_val = 'S'
            elif 1 <= num_f[0] <= 10:
                credits_val = num_f[0]
                
    g_match = re.search(grade_pattern, part, re.I)
    if g_match and grade_val == 'P':
        grade_val = g_match.group(1).upper()
        if grade_val == 'O': grade_val = 'S'

    if len(name) > 3:
        if 'subject' not in name.lower() and 'coda' not in name.lower():
            subjects.append({
                'code': code,
                'name': name[:45],
                'credits': int(credits_val) if credits_val == int(credits_val) else credits_val,
                'grade': grade_val
            })

print(f"Extracted {len(subjects)}")
print(subjects)
