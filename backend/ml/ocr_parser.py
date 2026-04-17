import io
import base64
import re
import numpy as np
from PIL import Image
import easyocr

# Initialize once (global)
reader = easyocr.Reader(['en'], gpu=False)

def extract_gradesheet_data(image_b64):
    try:
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]
        img_bytes = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')

        # Use bounding box detail=1 so we know where every token is
        results = reader.readtext(np.array(img), detail=1)

        # Build token list with full position info
        tokens = []
        for (bbox, text, conf) in results:
            t = text.strip()
            if not t:
                continue
            # Fix common OCR digit corruptions in number-like tokens
            t_fixed = t.replace(',', '.')
            if re.match(r'^[A-Za-z]\d', t_fixed) and len(t_fixed) <= 5:
                # e.g. J0.00 → 30.00, l0.00 → 10.00
                fixes = {'J': '3', 'j': '3', 'l': '1', 'I': '1', 'O': '0', 'o': '0', 'Z': '2', 'z': '2', 'S': '5', 'B': '8'}
                first_char = t_fixed[0]
                if first_char in fixes:
                    t_fixed = fixes[first_char] + t_fixed[1:]
                    t = t_fixed
            x1 = bbox[0][0]
            y1 = bbox[0][1]
            x2 = bbox[1][0]
            y2 = bbox[2][1]
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            tokens.append({"text": t, "x": x1, "cx": cx, "y": y1, "cy": cy, "x2": x2, "y2": y2})

        # Full text for debug + SGPA/CGPA
        full_text = ' '.join(tok["text"] for tok in tokens)
        full_text_clean = re.sub(r'\s+', ' ', full_text)
        full_text_clean = full_text_clean.replace('.,', '.').replace(',.', '.').replace(',', '.')

        print('DEBUG RAW:', repr(full_text_clean[:1000]))

        sgpa_match = re.search(r'SGPA[^\d]*(\d+\.\d+)', full_text_clean, re.I)
        cgpa_match = re.search(r'CGPA[^\d]*(\d+\.\d+)', full_text_clean, re.I)
        sgpa_val = float(sgpa_match.group(1)) if sgpa_match else None
        cgpa_val = float(cgpa_match.group(1)) if cgpa_match else None

        # ─── Detect Grade column header X position ──────────────────────────────
        grade_col_x = None
        credits_col_x = None
        for tok in tokens:
            tl = tok["text"].lower().strip('|:')
            if tl == 'grade':
                grade_col_x = tok["cx"]
            if tl in ('credits', 'credits|', 'credit', 'ci', '(ci)'):
                credits_col_x = tok["cx"]

        # ─── Course code detection ───────────────────────────────────────────────
        # Codes look like 22MTC04, 22cSc21, 22EECO1 (OCR may confuse 0↔O, 1↔I)
        CODE_RE = re.compile(r'^[\[/|(]?([0-9oOiIzZ]{2}[A-Za-z]{3,5}[0-9oOiIzZ]{1,3})$')
        GRADE_RE = re.compile(r'^(S|A\+|A|B\+|B|C|D|E|O)$', re.I)
        NUM_RE = re.compile(r'^\d+(?:\.\d+)?$')

        # Sort all tokens by Y then X
        tokens.sort(key=lambda t: (t["cy"], t["cx"]))

        # Group tokens into visual rows
        ROW_THRESH = 18
        rows = []
        current_row = []
        for tok in tokens:
            if not current_row:
                current_row.append(tok)
            elif abs(tok["cy"] - current_row[0]["cy"]) < ROW_THRESH:
                current_row.append(tok)
            else:
                rows.append(sorted(current_row, key=lambda t: t["cx"]))
                current_row = [tok]
        if current_row:
            rows.append(sorted(current_row, key=lambda t: t["cx"]))

        subjects = []
        seen_codes = set()

        for row in rows:
            # Find the course code token in this row
            code_tok = None
            for tok in row:
                m = CODE_RE.match(tok["text"])
                if m:
                    code_tok = tok
                    break
            if code_tok is None:
                continue

            raw_code = CODE_RE.match(code_tok["text"]).group(1)
            # Normalize OCR confusions: uppercase, replace O->0 in digits position
            code = raw_code.upper()

            if code in seen_codes:
                continue

            # ── Extract grade ─────────────────────────────────────────────────
            grade = '?'
            # Strategy A: if we know the grade column X, pick the closest token at that X
            if grade_col_x is not None:
                candidates = [t for t in row if GRADE_RE.match(t["text"])]
                if candidates:
                    closest = min(candidates, key=lambda t: abs(t["cx"] - grade_col_x))
                    grade = closest["text"].upper()
                    if grade == 'O': grade = 'S'
            # Strategy B: any grade letter token in the row
            if grade == '?':
                for tok in row:
                    if GRADE_RE.match(tok["text"]):
                        grade = tok["text"].upper()
                        if grade == 'O': grade = 'S'
                        break
            
            # Strategy C: Math fallback — derive grade from Grade Points Secured ÷ Credits
            # CBIT marksheet: Points Secured = Credits × Grade Value
            # So Grade Value = Points / Credits
            if grade == '?':
                grade_map = {10: 'S', 9: 'A', 8: 'B', 7: 'C', 6: 'D', 5: 'E'}
                all_nums = []
                for t in row:
                    txt = t["text"].replace(',', '.')
                    if NUM_RE.match(txt):
                        all_nums.append((t, float(txt)))
                
                small_nums = [(t, v) for t, v in all_nums if 0.5 <= v <= 6]
                big_nums = [(t, v) for t, v in all_nums if v >= 7]
                
                # Case 1: Both credits and points detected
                if small_nums and big_nums:
                    cr = small_nums[0][1]
                    pts = big_nums[0][1]
                    if cr > 0:
                        gv = round(pts / cr)
                        grade = grade_map.get(gv, '?')
                
                # Case 2: Only points detected — try common credit values
                elif big_nums and not small_nums:
                    pts = big_nums[0][1]
                    for try_cr in [1, 1.5, 2, 3, 4, 5]:
                        gv = round(pts / try_cr)
                        if gv in grade_map:
                            grade = grade_map[gv]
                            break

            # ── Extract credits ───────────────────────────────────────────────
            credits = 3
            num_tokens = [t for t in row if NUM_RE.match(t["text"].replace(',', '.'))]
            # Only consider numbers in range 1–6 as credits
            credit_candidates = []
            for t in num_tokens:
                val = float(t["text"].replace(',', '.'))
                if 0.5 <= val <= 6:
                    credit_candidates.append((t, val))

            if credit_candidates:
                if credits_col_x is not None:
                    # Pick the one closest to the known credits column
                    best = min(credit_candidates, key=lambda tv: abs(tv[0]["cx"] - credits_col_x))
                    credits = best[1]
                else:
                    # If multiple candidates exist, pick the first (leftmost) one
                    credits = credit_candidates[0][1]

            # ── Extract subject name ──────────────────────────────────────────
            # Take all text tokens to the right of the code that are NOT the grade or a pure number
            skip_texts = {code_tok["text"]}
            name_parts = []
            past_code = False
            for tok in row:
                if tok is code_tok:
                    past_code = True
                    continue
                if not past_code:
                    continue
                txt = tok["text"].strip()
                if GRADE_RE.match(txt):
                    continue
                if NUM_RE.match(txt.replace(',', '.')):
                    continue
                if txt.lower() in ('p', 'f', 'pass', 'fail'):
                    continue
                name_parts.append(txt)

            name = ' '.join(name_parts)
            # Remove leading bracket/slash OCR artefacts
            name = re.sub(r'^[\[/|(I1]+', '', name)
            name = re.sub(r'[^a-zA-Z\s\-&()]', ' ', name).strip()
            name = re.sub(r'\s+', ' ', name)

            # Skip header rows or junk
            if len(name) < 4 or name.lower().startswith('subject'):
                continue
            if any(junk in name.lower() for junk in ['total', 'sgpa', 'cgpa', 'result', 'activ']):
                continue

            seen_codes.add(code)
            subjects.append({
                "code": code,
                "name": name[:55],
                "credits": int(credits) if credits == int(credits) else credits,
                "grade": grade
            })

        print(f'EXTRACTED: {len(subjects)} subjects | SGPA: {sgpa_val} | CGPA: {cgpa_val}')
        return {
            "success": len(subjects) > 0,
            "subjects": subjects,
            "sgpa": sgpa_val,
            "cgpa": cgpa_val,
            "raw": full_text_clean[:500]
        }

    except Exception as e:
        import traceback
        print("OCR ERROR:", traceback.format_exc())
        return {"success": False, "error": str(e), "subjects": []}