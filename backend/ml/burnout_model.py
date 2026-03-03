import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import os

def generate_training_data(n=1000):
    np.random.seed(42)
    data = {
        'study_hours': np.random.uniform(2, 14, n),
        'sleep_hours': np.random.uniform(4, 10, n),
        'social_time': np.random.uniform(0, 6, n),
        'exercise_time': np.random.uniform(0, 3, n),
        'deadline_pressure': np.random.uniform(1, 10, n),
        'academic_load': np.random.uniform(1, 10, n),
    }
    df = pd.DataFrame(data)
    # Create burnout score
    score = (
        (df['study_hours'] > 8).astype(int) * 25 +
        (df['sleep_hours'] < 6).astype(int) * 25 +
        (df['social_time'] < 1).astype(int) * 15 +
        (df['exercise_time'] < 1).astype(int) * 10 +
        (df['deadline_pressure'] / 10) * 15 +
        (df['academic_load'] / 10) * 10
    )
    df['burnout_level'] = pd.cut(score, bins=[0, 30, 60, 80, 100],
                                  labels=['Low', 'Moderate', 'High', 'Critical'])
    return df

def train_model():
    df = generate_training_data()
    features = ['study_hours', 'sleep_hours', 'social_time', 'exercise_time', 'deadline_pressure', 'academic_load']
    X = df[features]
    y = df['burnout_level']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train_scaled, y_train)
    accuracy = model.score(X_test_scaled, y_test)
    print(f"Model accuracy: {accuracy:.2%}")
    joblib.dump(model, 'burnout_model.pkl')
    joblib.dump(scaler, 'burnout_scaler.pkl')
    return model, scaler

if __name__ == '__main__':
    train_model()
    print("Model trained and saved!")