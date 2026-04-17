# import pandas as pd
# import numpy as np
# import joblib
# import json
# import matplotlib.pyplot as plt
# import seaborn as sns
# from sklearn.ensemble import RandomForestClassifier
# from sklearn.model_selection import train_test_split
# from sklearn.preprocessing import StandardScaler, LabelEncoder
# from sklearn.metrics import (
#     classification_report, confusion_matrix,
#     accuracy_score, roc_auc_score
# )
# from tensorflow.keras.models import Sequential, Model
# from tensorflow.keras.layers import (
#     LSTM, Dense, Dropout, Input, concatenate
# )
# from tensorflow.keras.callbacks import EarlyStopping
# from tensorflow.keras.utils import to_categorical
# import warnings
# warnings.filterwarnings('ignore')

# print("Loading dataset...")
# df = pd.read_csv('flood_dataset.csv')
# df['date'] = pd.to_datetime(df['date'])
# df = df.sort_values(['region', 'date']).reset_index(drop=True)

# # ── FEATURE COLUMNS ───────────────────────────────────────
# FEATURES = [
#     'rainfall_mm', 'rainfall_3day_mm', 'rainfall_7day_mm',
#     'temperature_celsius', 'humidity_percent', 'wind_speed_kmh',
#     'river_level_m', 'river_level_change', 'water_discharge_m3s',
#     'soil_moisture', 'elevation_m', 'distance_to_river_km',
#     'slope_degree', 'land_use_type', 'days_since_flood',
#     'flood_occurred_prev'
# ]
# TARGET      = 'flood_risk'
# TARGET_PRIO = 'priority_level'

# # ── LABEL ENCODE PRIORITY ─────────────────────────────────
# le = LabelEncoder()
# priority_order = ['low', 'moderate', 'high', 'critical']
# df['priority_encoded'] = df[TARGET_PRIO].map(
#     {p: i for i, p in enumerate(priority_order)}
# )

# # ── TRAIN/TEST SPLIT ──────────────────────────────────────
# X = df[FEATURES]
# y = df[TARGET]
# y_prio = df['priority_encoded']

# X_train, X_test, y_train, y_test, yp_train, yp_test = train_test_split(
#     X, y, y_prio, test_size=0.2, random_state=42, stratify=y
# )

# print(f"Train size: {len(X_train)}")
# print(f"Test size:  {len(X_test)}")

# # ── SCALE FEATURES ────────────────────────────────────────
# scaler = StandardScaler()
# X_train_sc = scaler.fit_transform(X_train)
# X_test_sc  = scaler.transform(X_test)

# # ══════════════════════════════════════════════════════════
# # PART 1: RANDOM FOREST
# # ══════════════════════════════════════════════════════════
# print("\n── Training Random Forest ──────────────────────")

# rf_model = RandomForestClassifier(
#     n_estimators=200,
#     max_depth=15,
#     min_samples_split=5,
#     min_samples_leaf=2,
#     class_weight='balanced',
#     random_state=42,
#     n_jobs=-1
# )
# rf_model.fit(X_train_sc, y_train)

# rf_preds = rf_model.predict(X_test_sc)
# rf_proba = rf_model.predict_proba(X_test_sc)[:, 1]

# print(f"RF Accuracy:  {accuracy_score(y_test, rf_preds):.4f}")
# print(f"RF ROC-AUC:   {roc_auc_score(y_test, rf_proba):.4f}")
# print("\nRF Classification Report:")
# print(classification_report(y_test, rf_preds, target_names=['No Flood', 'Flood']))

# # Feature importance
# fi = pd.DataFrame({
#     'feature':   FEATURES,
#     'importance': rf_model.feature_importances_
# }).sort_values('importance', ascending=False)
# print("\nTop 5 Important Features:")
# print(fi.head())

# # ══════════════════════════════════════════════════════════
# # PART 2: LSTM
# # ══════════════════════════════════════════════════════════
# print("\n── Preparing LSTM sequences ────────────────────")

# SEQUENCE_LEN = 7  # use last 7 days to predict next day

# def create_sequences(data_scaled, labels, seq_len=7):
#     X_seq, y_seq = [], []
#     for i in range(seq_len, len(data_scaled)):
#         X_seq.append(data_scaled[i-seq_len:i])
#         y_seq.append(labels[i])
#     return np.array(X_seq), np.array(y_seq)

# # Use full scaled dataset for LSTM sequences
# X_all_sc = scaler.transform(X)
# y_all    = y.values

# X_lstm, y_lstm = create_sequences(X_all_sc, y_all, SEQUENCE_LEN)

# # Split sequences
# split = int(len(X_lstm) * 0.8)
# X_lstm_train, X_lstm_test = X_lstm[:split], X_lstm[split:]
# y_lstm_train, y_lstm_test = y_lstm[:split], y_lstm[split:]

# print(f"LSTM train sequences: {len(X_lstm_train)}")
# print(f"LSTM test sequences:  {len(X_lstm_test)}")
# print(f"Sequence shape:       {X_lstm_train.shape}")

# print("\n── Training LSTM ────────────────────────────────")

# lstm_model = Sequential([
#     LSTM(64, input_shape=(SEQUENCE_LEN, len(FEATURES)),
#          return_sequences=True),
#     Dropout(0.2),
#     LSTM(32, return_sequences=False),
#     Dropout(0.2),
#     Dense(16, activation='relu'),
#     Dense(1, activation='sigmoid')
# ])

# lstm_model.compile(
#     optimizer='adam',
#     loss='binary_crossentropy',
#     metrics=['accuracy']
# )

# lstm_model.summary()

# early_stop = EarlyStopping(
#     monitor='val_loss',
#     patience=5,
#     restore_best_weights=True
# )

# history = lstm_model.fit(
#     X_lstm_train, y_lstm_train,
#     epochs=30,
#     batch_size=64,
#     validation_split=0.1,
#     callbacks=[early_stop],
#     verbose=1
# )

# lstm_proba = lstm_model.predict(X_lstm_test).flatten()
# lstm_preds = (lstm_proba > 0.5).astype(int)

# print(f"\nLSTM Accuracy: {accuracy_score(y_lstm_test, lstm_preds):.4f}")
# print(f"LSTM ROC-AUC:  {roc_auc_score(y_lstm_test, lstm_proba):.4f}")
# print("\nLSTM Classification Report:")
# print(classification_report(
#     y_lstm_test, lstm_preds,
#     target_names=['No Flood', 'Flood']
# ))

# # ══════════════════════════════════════════════════════════
# # PART 3: ENSEMBLE (RF + LSTM combined)
# # ══════════════════════════════════════════════════════════
# print("\n── Ensemble predictions ─────────────────────────")

# # Match RF predictions to LSTM test size
# rf_proba_matched = rf_model.predict_proba(
#     X_test_sc[-len(lstm_proba):]
# )[:, 1]

# # Weighted average: RF=40%, LSTM=60%
# ensemble_proba = 0.4 * rf_proba_matched + 0.6 * lstm_proba
# ensemble_preds = (ensemble_proba > 0.5).astype(int)
# y_matched      = y_test.values[-len(lstm_proba):]

# print(f"Ensemble Accuracy: {accuracy_score(y_matched, ensemble_preds):.4f}")
# print(f"Ensemble ROC-AUC:  {roc_auc_score(y_matched, ensemble_proba):.4f}")
# print("\nEnsemble Classification Report:")
# print(classification_report(
#     y_matched, ensemble_preds,
#     target_names=['No Flood', 'Flood']
# ))

# # ── CONFUSION MATRIX PLOT ─────────────────────────────────
# cm = confusion_matrix(y_matched, ensemble_preds)
# plt.figure(figsize=(6, 4))
# sns.heatmap(cm, annot=True, fmt='d', cmap='Reds',
#             xticklabels=['No Flood', 'Flood'],
#             yticklabels=['No Flood', 'Flood'])
# plt.title('Ensemble Model — Confusion Matrix')
# plt.tight_layout()
# plt.savefig('confusion_matrix.png')
# print("\nSaved confusion_matrix.png")

# # ── TRAINING HISTORY PLOT ─────────────────────────────────
# plt.figure(figsize=(10, 4))
# plt.subplot(1, 2, 1)
# plt.plot(history.history['accuracy'],     label='Train Accuracy')
# plt.plot(history.history['val_accuracy'], label='Val Accuracy')
# plt.title('LSTM Accuracy')
# plt.legend()

# plt.subplot(1, 2, 2)
# plt.plot(history.history['loss'],     label='Train Loss')
# plt.plot(history.history['val_loss'], label='Val Loss')
# plt.title('LSTM Loss')
# plt.legend()

# plt.tight_layout()
# plt.savefig('training_history.png')
# print("Saved training_history.png")

# # ── SAVE MODELS ───────────────────────────────────────────
# print("\n── Saving models ────────────────────────────────")

# joblib.dump(rf_model, 'rf_model.pkl')
# print("Saved rf_model.pkl")

# lstm_model.save('lstm_model.h5')
# print("Saved lstm_model.h5")

# joblib.dump(scaler, 'scaler.pkl')
# print("Saved scaler.pkl")

# # Save metadata
# metadata = {
#     'features':       FEATURES,
#     'sequence_len':   SEQUENCE_LEN,
#     'priority_order': priority_order,
#     'rf_accuracy':    float(accuracy_score(y_test, rf_preds)),
#     'lstm_accuracy':  float(accuracy_score(y_lstm_test, lstm_preds)),
#     'ensemble_accuracy': float(accuracy_score(y_matched, ensemble_preds)),
#     'ensemble_roc_auc':  float(roc_auc_score(y_matched, ensemble_proba))
# }

# with open('model_metadata.json', 'w') as f:
#     json.dump(metadata, f, indent=2)
# print("Saved model_metadata.json")

# print("\n✅ All models saved successfully!")
# print(f"\n── Final Results ────────────────────────────────")
# print(f"RF Accuracy:       {metadata['rf_accuracy']:.4f}")
# print(f"LSTM Accuracy:     {metadata['lstm_accuracy']:.4f}")
# print(f"Ensemble Accuracy: {metadata['ensemble_accuracy']:.4f}")
# print(f"Ensemble ROC-AUC:  {metadata['ensemble_roc_auc']:.4f}")

import pandas as pd
import numpy as np
import joblib
import json

from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

print("Loading dataset...")
df = pd.read_csv('/content/drive/MyDrive/flood_dataset.csv')

# ================================
# FEATURES
# ================================
FEATURES = [
    'rainfall_mm','rainfall_3day_mm','rainfall_7day_mm',
    'temperature_celsius','humidity_percent','wind_speed_kmh',
    'river_level_m','river_level_change','water_discharge_m3s',
    'soil_moisture','elevation_m','distance_to_river_km',
    'slope_degree','land_use_type','days_since_flood',
    'flood_occurred_prev'
]

TARGET = 'flood_risk'

# ================================
# SORT (IMPORTANT)
# ================================
df['date'] = pd.to_datetime(df['date'])
df = df.sort_values(['region','date']).reset_index(drop=True)

X = df[FEATURES].values
y = df[TARGET].values

# ================================
# SCALE
# ================================
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ================================
# CREATE SEQUENCES (LSTM)
# ================================
SEQUENCE_LEN = 7

def create_sequences(X, y, seq_len):
    X_seq, y_seq = [], []
    for i in range(seq_len, len(X)):
        X_seq.append(X[i-seq_len:i])
        y_seq.append(y[i])
    return np.array(X_seq), np.array(y_seq)

X_seq, y_seq = create_sequences(X_scaled, y, SEQUENCE_LEN)

# ================================
# TIME-BASED SPLIT (NO LEAKAGE)
# ================================
split = int(len(X_seq) * 0.8)

X_train, X_test = X_seq[:split], X_seq[split:]
y_train, y_test = y_seq[:split], y_seq[split:]

print("Train shape:", X_train.shape)
print("Test shape :", X_test.shape)

# ================================
# LSTM MODEL
# ================================
print("\nTraining LSTM...")

lstm_model = Sequential([
    LSTM(64, return_sequences=True,
         input_shape=(SEQUENCE_LEN, len(FEATURES))),
    Dropout(0.2),
    LSTM(32),
    Dense(16, activation='relu'),
    Dense(1, activation='sigmoid')
])

lstm_model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy']
)

early_stop = EarlyStopping(patience=5, restore_best_weights=True)

lstm_model.fit(
    X_train, y_train,
    validation_split=0.1,
    epochs=30,
    batch_size=64,
    callbacks=[early_stop],
    verbose=1
)

# ================================
# LSTM OUTPUT
# ================================
lstm_train_pred = lstm_model.predict(X_train)
lstm_test_pred  = lstm_model.predict(X_test)

# ================================
# RANDOM FOREST (FIXED VERSION ✅)
# ================================
print("\nTraining Random Forest...")

# Use ONLY last-day features (IMPORTANT FIX)
X_rf_train = X_train[:, -1, :]
X_rf_test  = X_test[:, -1, :]

rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    class_weight='balanced',
    random_state=42
)

rf.fit(X_rf_train, y_train)

# ================================
# FINAL EVALUATION (ENSEMBLE)
# ================================
rf_proba   = rf.predict_proba(X_rf_test)[:, 1]
lstm_proba = lstm_test_pred.flatten()

# Combine both
final_proba = 0.4 * rf_proba + 0.6 * lstm_proba
final_preds = (final_proba > 0.5).astype(int)

print("\nFINAL RESULTS (ENSEMBLE):")
print("Accuracy:", accuracy_score(y_test, final_preds))
print("ROC-AUC :", roc_auc_score(y_test, final_proba))

print("\nClassification Report:")
print(classification_report(y_test, final_preds))

# ================================
# SAVE MODELS
# ================================
joblib.dump(rf, '/content/drive/MyDrive/rf_model.pkl')
lstm_model.save('/content/drive/MyDrive/lstm_model.h5')
joblib.dump(scaler, '/content/drive/MyDrive/scaler.pkl')

metadata = {
    "features": FEATURES,
    "sequence_length": SEQUENCE_LEN
}

with open('/content/drive/MyDrive/metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print("✅ Saved to Google Drive")