from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import json
import requests
import os
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timedelta, timezone
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

app = Flask(__name__)
CORS(app)

print("Loading earthquake models...")

eq_rf_alert_model = joblib.load("eq_rf_alert_model.pkl")
eq_rf_zone_model = joblib.load("eq_rf_zone_model.pkl")
eq_scaler = joblib.load("eq_scaler.pkl")
eq_magType_le = joblib.load("eq_magType_encoder.pkl")
eq_type_le = joblib.load("eq_type_encoder.pkl")
eq_status_le = joblib.load("eq_status_encoder.pkl")
eq_zone_le = joblib.load("eq_zone_encoder.pkl")

eq_lstm_model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(10, 7)),
    Dropout(0.2),
    LSTM(32),
    Dropout(0.2),
    Dense(16, activation='relu'),
    Dense(1)
])

eq_lstm_model.build((None, 10, 7))
eq_lstm_model.load_weights("eq_lstm_weights.weights.h5")

with open("earthquake_metadata.json") as f:
    eq_metadata = json.load(f)

RF_FEATURE_COLS = eq_metadata["rf_feature_cols"]
LSTM_FEATURES = eq_metadata["lstm_features"]
SEQUENCE_LENGTH = eq_metadata["sequence_length"]

recent_sequences = {}

print("✅ Earthquake API ready")


def encode_safe(le, value):
    classes = set(le.classes_)
    if value in classes:
        return int(le.transform([value])[0])
    fallback = le.classes_[0]
    return int(le.transform([fallback])[0])


def distance_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def get_recent_earthquakes():
    try:
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=24)

        url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
        params = {
            "format": "geojson",
            "starttime": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "endtime": end_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "minmagnitude": 4,
            "limit": 10,
            "orderby": "time"
        }

        # If you want India-focused results later, uncomment these:
        # params["minlatitude"] = 6
        # params["maxlatitude"] = 37
        # params["minlongitude"] = 68
        # params["maxlongitude"] = 97

        res = requests.get(url, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()

        earthquakes = []

        for feature in data.get("features", []):
            props = feature.get("properties", {})
            geom = feature.get("geometry", {})
            coords = geom.get("coordinates", [None, None, None])

            lng = coords[0]
            lat = coords[1]
            depth = coords[2]

            if lat is None or lng is None:
                continue

            earthquakes.append({
                "region": props.get("place", "Unknown Region"),
                "lat": float(lat),
                "lng": float(lng),
                "depth": float(depth if depth is not None else 20.0),
                "mag": float(props.get("mag", 4.0) or 4.0),
                "time": props.get("time")
            })

        return earthquakes

    except Exception as e:
        print("Error fetching earthquakes from USGS:", e)
        return []


def build_feature_row(payload):
    now = datetime.utcnow()

    mag_type = payload.get("magType", "mb")
    eq_type = payload.get("type", "earthquake")
    status = payload.get("status", "reviewed")

    row = {
        "latitude": float(payload.get("lat", 17.385)),
        "longitude": float(payload.get("lng", 78.487)),
        "depth": float(payload.get("depth", 20.0)),
        "nst": float(payload.get("nst", 20)),
        "gap": float(payload.get("gap", 80)),
        "dmin": float(payload.get("dmin", 1.5)),
        "rms": float(payload.get("rms", 0.8)),
        "year": now.year,
        "month": now.month,
        "day": now.day,
        "hour": now.hour,
        "minute": now.minute,
        "dayofweek": now.weekday(),
        "is_weekend": 1 if now.weekday() >= 5 else 0,
        "magType_enc": encode_safe(eq_magType_le, mag_type),
        "type_enc": encode_safe(eq_type_le, eq_type),
        "status_enc": encode_safe(eq_status_le, status),
    }

    return row


def get_lstm_prediction(region_key, lat, lng, depth, gap_hours, mag_value=4.0):
    now = datetime.utcnow()
    row = {
        "mag": float(mag_value),
        "depth": depth,
        "latitude": lat,
        "longitude": lng,
        "gap_hours": gap_hours,
        "hour": now.hour,
        "dayofweek": now.weekday()
    }

    if region_key not in recent_sequences:
        recent_sequences[region_key] = []

    recent_sequences[region_key].append([row[c] for c in LSTM_FEATURES])

    if len(recent_sequences[region_key]) > SEQUENCE_LENGTH:
        recent_sequences[region_key].pop(0)

    if len(recent_sequences[region_key]) < SEQUENCE_LENGTH:
        return float(mag_value)

    seq_df = pd.DataFrame(recent_sequences[region_key], columns=LSTM_FEATURES)
    seq_scaled = eq_scaler.transform(seq_df)
    seq_scaled = np.expand_dims(seq_scaled, axis=0)

    pred = float(eq_lstm_model.predict(seq_scaled, verbose=0)[0][0])
    return pred


def predict_earthquake(payload):
    features_row = build_feature_row(payload)
    rf_df = pd.DataFrame([features_row])[RF_FEATURE_COLS]

    alert_pred = int(eq_rf_alert_model.predict(rf_df)[0])
    alert_prob = float(eq_rf_alert_model.predict_proba(rf_df)[0].max())

    zone_pred = int(eq_rf_zone_model.predict(rf_df)[0])
    predicted_zone = eq_zone_le.inverse_transform([zone_pred])[0]

    next_mag_pred = get_lstm_prediction(
        region_key=payload.get("region", "Custom"),
        lat=float(payload.get("lat", 17.385)),
        lng=float(payload.get("lng", 78.487)),
        depth=float(payload.get("depth", 20.0)),
        gap_hours=float(payload.get("gap_hours", 24.0)),
        mag_value=float(payload.get("mag", 4.0))
    )

    estimated_next_time = datetime.utcnow() + timedelta(hours=float(payload.get("gap_hours", 24.0)))

    return {
        "type": "earthquake",
        "region": payload.get("region", "Custom"),
        "lat": float(payload.get("lat", 17.385)),
        "lng": float(payload.get("lng", 78.487)),
        "alert": alert_pred,
        "alert_confidence": round(alert_prob, 4),
        "predicted_zone": predicted_zone,
        "predicted_next_magnitude": round(float(next_mag_pred), 4),
        "estimated_next_event_time": estimated_next_time.isoformat(),
        "priority": (
            "critical" if alert_prob > 0.85 else
            "high" if alert_prob > 0.65 else
            "moderate" if alert_prob > 0.45 else
            "low"
        ),
        "message": "High earthquake risk detected" if alert_pred == 1 else "No high-risk alert",
        "model_used": "rf+lstm"
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "earthquake"})


@app.route("/predict", methods=["POST"])
def predict():
    data = request.json or {}
    result = predict_earthquake(data)
    return jsonify(result)


@app.route("/predictions", methods=["GET"])
def predictions():
    live_eqs = get_recent_earthquakes()

    results = []

    for eq in live_eqs:
        payload = {
            "region": eq["region"],
            "lat": eq["lat"],
            "lng": eq["lng"],
            "depth": eq["depth"],
            "mag": eq["mag"],
            "magType": "mb",
            "type": "earthquake",
            "status": "reviewed",
            "nst": 20,
            "gap": 80,
            "dmin": 1.5,
            "rms": 0.8,
            "gap_hours": 24.0
        }

        results.append(predict_earthquake(payload))

    results.sort(key=lambda x: x["alert_confidence"], reverse=True)
    return jsonify({"predictions": results})


if __name__ == "__main__":
    # Render/Cloud injects PORT. Default keeps local workflow unchanged.
    port = int(os.getenv("PORT", "5003"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)