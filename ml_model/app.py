from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import json
import requests
from datetime import datetime
from tensorflow.keras.models import load_model

app = Flask(__name__)
CORS(app)

print("Loading models...")

# ── LOAD MODELS ─────────────────────────────────────────
rf_model   = joblib.load('rf_model.pkl')
lstm_model = load_model('lstm_model.h5')
scaler     = joblib.load('scaler.pkl')

with open('metadata.json') as f:
    metadata = json.load(f)

FEATURES     = metadata['features']
SEQUENCE_LEN = metadata['sequence_length']

# Store last 7 days data for LSTM
recent_data = {}

print("✅ Models loaded. API ready.")

# ── REGIONS (only fixed data) ────────────────────────────
REGIONS = [
    {'region': 'Hyderabad',  'lat': 17.385, 'lng': 78.487, 'elevation_m': 542},
    {'region': 'Mumbai',     'lat': 19.076, 'lng': 72.877, 'elevation_m': 14},
    {'region': 'Chennai',    'lat': 13.083, 'lng': 80.270, 'elevation_m': 6},
    {'region': 'Kolkata',    'lat': 22.572, 'lng': 88.363, 'elevation_m': 9},
    {'region': 'Patna',      'lat': 25.594, 'lng': 85.137, 'elevation_m': 53},
    {'region': 'Guwahati',   'lat': 26.144, 'lng': 91.736, 'elevation_m': 55},
    {'region': 'Bhubaneswar','lat': 20.296, 'lng': 85.824, 'elevation_m': 45},
    {'region': 'Surat',      'lat': 21.170, 'lng': 72.831, 'elevation_m': 13},
]

# ── FETCH REAL WEATHER ───────────────────────────────────
def get_weather(lat, lng):
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            'latitude': lat,
            'longitude': lng,
            'current': [
                'precipitation',
                'temperature_2m',
                'relative_humidity_2m',
                'wind_speed_10m'
            ],
            'timezone': 'Asia/Kolkata'
        }

        res = requests.get(url, params=params, timeout=10).json()
        current = res.get('current', {})

        rainfall = float(current.get('precipitation', 0) or 0)

        return {
            'rainfall_mm': rainfall,
            'rainfall_3day_mm': rainfall * 3,   # approximation
            'rainfall_7day_mm': rainfall * 7,   # approximation
            'temperature_celsius': float(current.get('temperature_2m', 30)),
            'humidity_percent': float(current.get('relative_humidity_2m', 70)),
            'wind_speed_kmh': float(current.get('wind_speed_10m', 10)),
            'soil_moisture': min(100, rainfall * 2 + 30),

            # Estimated values
            'river_level_m': 2 + rainfall * 0.05,
            'river_level_change': rainfall * 0.02,
            'water_discharge_m3s': 500 + rainfall * 20
        }

    except:
        # fallback if API fails
        return {
            'rainfall_mm': 20,
            'rainfall_3day_mm': 60,
            'rainfall_7day_mm': 100,
            'temperature_celsius': 30,
            'humidity_percent': 70,
            'wind_speed_kmh': 10,
            'soil_moisture': 50,
            'river_level_m': 3,
            'river_level_change': 0.2,
            'water_discharge_m3s': 600
        }

# ── HELPER FUNCTIONS ─────────────────────────────────────
def get_priority(score):
    if score > 0.75: return "critical"
    elif score > 0.55: return "high"
    elif score > 0.35: return "moderate"
    else: return "low"

# ── CORE PREDICTION FUNCTION ─────────────────────────────
def predict_region(region_info):
    region = region_info['region']

    weather = get_weather(region_info['lat'], region_info['lng'])

    # Build feature input
    input_data = {
        **weather,
        'elevation_m': region_info['elevation_m'],
        'distance_to_river_km': 2,
        'slope_degree': 3,
        'land_use_type': 0,
        'days_since_flood': 30,
        'flood_occurred_prev': 0
    }

    input_df = pd.DataFrame([input_data])[FEATURES]
    input_sc = scaler.transform(input_df)

    # RF prediction
    rf_proba = float(rf_model.predict_proba(input_sc)[0][1])

    # LSTM memory
    if region not in recent_data:
        recent_data[region] = []

    recent_data[region].append(input_sc[0].tolist())

    if len(recent_data[region]) > SEQUENCE_LEN:
        recent_data[region].pop(0)

    # LSTM prediction
    if len(recent_data[region]) == SEQUENCE_LEN:
        seq = np.array([recent_data[region]])
        lstm_proba = float(lstm_model.predict(seq, verbose=0)[0][0])
        final = 0.4 * rf_proba + 0.6 * lstm_proba
        model_used = "ensemble"
    else:
        final = rf_proba
        model_used = "rf_only"

    return {
        'region': region,
        'lat': region_info['lat'],
        'lng': region_info['lng'],
        'risk_score': round(final, 4),
        'flood_predicted': final > 0.5,
        'priority': get_priority(final),
        'model_used': model_used,
        'rainfall_mm': weather['rainfall_mm'],
        'river_level_m': weather['river_level_m']
    }

# ── ROUTES ───────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

# Single prediction
@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    lat = data.get('lat', 17.385)
    lng = data.get('lng', 78.487)

    region_info = {
        'region': data.get('region', 'Custom'),
        'lat': lat,
        'lng': lng,
        'elevation_m': data.get('elevation_m', 100)
    }

    result = predict_region(region_info)
    return jsonify(result)

# All regions
@app.route('/predictions', methods=['GET'])
def predictions():
    results = [predict_region(r) for r in REGIONS]
    results.sort(key=lambda x: x['risk_score'], reverse=True)
    return jsonify(results)

# ── RUN ──────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(port=5002, debug=True)