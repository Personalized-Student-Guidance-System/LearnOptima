import re

raw = '/22cSc21 ISoftware Engineering 3.00 /22itco8 [Enterprise Application Development 3.00 122CAC17 Machine Learning S 3.00 [22ITC10 Icomputer Networks 3.00 [22ITC12 [Formal Languages and Automata Theory s 3.00 [22ITEO6 ISoftware Project Management (PE-Il) 3.00 122csc23 ICASE Tools Lab s 1.00 /22itco9 [Enterprise Application Development Lab S 1.00 122ITC11 (computer Networks Lab S 1.00 10 122CAC18 Machine Learning Lab S 1.00 11 [22ITC16 Icompetitive Coding S 1.00 12 [22iti02 IIndustrial Rural Internship-II 2.00'

code_pattern = r'(?:[\[/|1lI]|\b)([0-9oOiIzZ]{2}[A-Za-z]{3,4}[0-9oOiIzZ]{2,3})\b'

codes = list(re.finditer(code_pattern, raw))
print(f"Found {len(codes)} codes:")
for m in codes:
    print(m.group(1))
