from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
from enhanced_skill_analyzer import analyze_skill_gap

app = Flask(__name__)
CORS(app)

# Load model if exists
model, scaler = None, None
if os.path.exists('burnout_model.pkl'):
    model = joblib.load('burnout_model.pkl')
    scaler = joblib.load('burnout_scaler.pkl')

@app.route('/predict-burnout', methods=['POST'])
def predict_burnout():
    data = request.json
    features = np.array([[
        data.get('studyHours', 6),
        data.get('sleepHours', 7),
        data.get('socialTime', 2),
        data.get('exerciseTime', 1),
        data.get('deadlinePressure', 5),
        data.get('academicLoad', 5)
    ]])
    
    if model and scaler:
        scaled = scaler.transform(features)
        prediction = model.predict(scaled)[0]
        proba = model.predict_proba(scaled)[0]
        confidence = round(max(proba) * 100, 1)
        return jsonify({'level': prediction, 'confidence': confidence})
    
    return jsonify({'error': 'Model not trained'}), 503

@app.route('/skill-gap', methods=['POST'])
def skill_gap():
    data = request.json
    result = analyze_skill_gap(data.get('skills', []), data.get('targetRole', 'Software Engineer'))
    return jsonify(result)

from enhanced_skill_analyzer import get_learning_path
@app.route('/learning-path', methods=['POST'])
def learning_path_api():
    data = request.json
    result = get_learning_path(data.get('skills', []), data.get('targetRole', 'Software Engineer'))
    return jsonify(result)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model_loaded': model is not None})

from skill_resources_scraper import SkillResourcesScraper

@app.route('/generate-roadmap', methods=['POST'])
def generate_roadmap():
    data = request.json
    role = data.get('role', 'Software Engineer')
    
    scraper = SkillResourcesScraper()
    roadmap_data = scraper.get_dynamic_role_resources(role)
    return jsonify(roadmap_data)

from ocr_parser import extract_gradesheet_data
@app.route('/extract-gradesheet', methods=['POST'])
def extract_gradesheet():
    data = request.json
    image_b64 = data.get('image', '')
    if not image_b64:
        return jsonify({"success": False, "error": "No image provided"}), 400
        
    result = extract_gradesheet_data(image_b64)
    return jsonify(result)

@app.route('/reschedule', methods=['POST'])
def reschedule():
    data = request.json
    roadmap_phases = data.get('phases', [])
    existing_tasks = data.get('existing_tasks', [])
    user_prefs = data.get('user_prefs', {
        'max_study_hours': 4,
        'sleep_hours': 7,
        'academic_load': 5,
        'deadline_pressure': 5
    })
    
    agent = BurnoutAwarePlannerAgent()
    # Provide the loaded model explicitly if needed, but it loads internally.
    if model and scaler:
        agent.model = model
        agent.scaler = scaler
        
    new_schedule = agent.generate_daily_schedule(roadmap_phases, existing_tasks, user_prefs)
    return jsonify({'tasks': new_schedule})

@app.route('/orchestrate', methods=['POST'])
def orchestrate():
    data = request.json
    agent = BurnoutAwarePlannerAgent()
    result = agent.orchestrate(data)
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5001, debug=True)