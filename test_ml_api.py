import requests
print("Testing")
try:
    r = requests.post("http://localhost:5001/generate-roadmap", json={"role": "Quantum Cryptography Engineer"})
    print("Status:", r.status_code)
    print("Response:", r.text)
except Exception as e:
    print("Error:", e)
