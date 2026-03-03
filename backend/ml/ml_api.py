from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import numpy as np
from skill_gap_analyzer import analyze_skill_gap

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

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model_loaded': model is not None})

if __name__ == '__main__':
    app.run(port=5001, debug=True)