import requests
import json

print('Testing Health...')
health = requests.get('http://127.0.0.1:5001/health')
print(health.json())

print('Testing ML Roadmap Generate...')
payload = {
    'role': 'Data Scientist',
    'user_skills': ['python', 'pandas']
}
res = requests.post('http://127.0.0.1:5001/generate-roadmap', json=payload)
print(json.dumps(res.json(), indent=2))
