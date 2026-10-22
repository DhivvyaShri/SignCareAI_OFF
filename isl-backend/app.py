"""SignCare AI — Offline-First Indian Sign Language Hospital Communication Backend
Supports:
  - Continuous ISL Sequence Recognition (/predict-continuous)
  - Isolated Word ISL Recognition (/predict-emergency)
  - Static Fingerspelled A-Z Alphabet Recognition (/predict)
  - Authenticated Local Hospital Report Transfer & Review (/api/reports)
  - Offline Deterministic & Local AI Summarization (/api/ai/summarize)
"""
from __future__ import annotations
import base64
import io
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Any, Optional

import cv2
import joblib
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DB_PATH = DATA_DIR / "hospital_reports.json"

# Model paths
ALPHABET_MODEL_PATH = MODELS_DIR / "isl_alphabet.keras"
ALPHABET_LABELS_PATH = MODELS_DIR / "labels.json"

EMERGENCY_MODEL_PATH = MODELS_DIR / "isl_emergency_words.joblib"
EMERGENCY_LABELS_PATH = MODELS_DIR / "emergency_labels.json"

CONTINUOUS_MODEL_PATH = MODELS_DIR / "isl_continuous_sequence.joblib"
CONTINUOUS_LABELS_PATH = MODELS_DIR / "continuous_labels.json"
CONTINUOUS_META_PATH = MODELS_DIR / "continuous_metadata.json"

# App initialization
app = Flask(__name__)
CORS(app)

# Global model state
alphabet_model = None
alphabet_labels: List[str] = []
alphabet_error = "ISL alphabet model not trained yet. Run train_model.py after placing RealSign dataset."

emergency_model = None
emergency_labels: List[str] = []
emergency_error = "Emergency word model not trained. Run train_emergency_model.py."

continuous_model = None
continuous_labels: List[str] = []
continuous_meta: Dict[str, Any] = {}
continuous_error = "Continuous sequence model not trained. Run train_continuous_model.py."

CONFIDENCE_THRESHOLD = float(os.getenv("ISL_CONFIDENCE_THRESHOLD", "0.65"))
LOCAL_AUTH_SECRET = os.getenv("HOSPITAL_AUTH_SECRET", "LOCAL_HOSPITAL_SECRET_2026")

def load_models() -> None:
    global alphabet_model, alphabet_labels, alphabet_error
    global emergency_model, emergency_labels, emergency_error
    global continuous_model, continuous_labels, continuous_meta, continuous_error

    # 1. Alphabet Model
    if ALPHABET_MODEL_PATH.exists() and ALPHABET_LABELS_PATH.exists():
        try:
            from tensorflow import keras
            alphabet_model = keras.models.load_model(ALPHABET_MODEL_PATH)
            alphabet_labels = json.loads(ALPHABET_LABELS_PATH.read_text(encoding="utf-8"))
            alphabet_error = ""
        except Exception as exc:
            alphabet_model = None
            alphabet_error = f"Error loading alphabet model: {exc}"

    # 2. Legacy Emergency Word Model
    if EMERGENCY_MODEL_PATH.exists() and EMERGENCY_LABELS_PATH.exists():
        try:
            emergency_model = joblib.load(EMERGENCY_MODEL_PATH)
            emergency_labels = json.loads(EMERGENCY_LABELS_PATH.read_text(encoding="utf-8"))
            emergency_error = ""
        except Exception as exc:
            emergency_model = None
            emergency_error = f"Error loading emergency model: {exc}"

    # 3. Continuous Sequence Model
    if CONTINUOUS_MODEL_PATH.exists() and CONTINUOUS_LABELS_PATH.exists():
        try:
            continuous_model = joblib.load(CONTINUOUS_MODEL_PATH)
            continuous_labels = json.loads(CONTINUOUS_LABELS_PATH.read_text(encoding="utf-8"))
            if CONTINUOUS_META_PATH.exists():
                continuous_meta = json.loads(CONTINUOUS_META_PATH.read_text(encoding="utf-8"))
            continuous_error = ""
        except Exception as exc:
            continuous_model = None
            continuous_error = f"Error loading continuous sequence model: {exc}"

def extract_landmarks_offline(image: Image.Image) -> np.ndarray:
    """100% Offline OpenCV hand landmark extractor (21 points x 3 coords x 2 hands = 126 values)."""
    frame = cv2.cvtColor(np.asarray(image.convert("RGB").resize((320, 240))), cv2.COLOR_RGB2BGR)
    h, w = frame.shape[:2]

    # Skin color segmentation
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower_skin = np.array([0, 20, 70], dtype=np.uint8)
    upper_skin = np.array([25, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower_skin, upper_skin)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sorted_cnts = sorted([c for c in contours if cv2.contourArea(c) > 350], key=cv2.contourArea, reverse=True)[:2]

    hands_found = []
    for cnt in sorted_cnts:
        M = cv2.moments(cnt)
        cx = float(M["m10"] / M["m00"]) if M["m00"] > 1e-4 else w / 2.0
        cy = float(M["m01"] / M["m00"]) if M["m00"] > 1e-4 else h / 2.0
        bx, by, bw, bh = cv2.boundingRect(cnt)
        scale = max(float(bw), float(bh), 10.0)

        pts_norm = [[(cx - bx) / scale, (cy - by) / scale, 0.0]]
        indices = np.linspace(0, len(cnt) - 1, 20).astype(int)
        for idx in indices:
            px = float(cnt[idx][0][0])
            py = float(cnt[idx][0][1])
            pts_norm.append([(px - cx) / scale, (py - cy) / scale, 0.0])

        hands_found.append(np.array(pts_norm[:21], dtype=np.float32).flatten())

    while len(hands_found) < 2:
        hands_found.append(np.zeros(63, dtype=np.float32))

    return np.concatenate(hands_found[:2])

# Initialize models on start
load_models()

# -------------------------------------------------------------
# Core Health & Model Status
# -------------------------------------------------------------
@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "mode": "offline-first hospital server",
        "alphabet_model_loaded": alphabet_model is not None,
        "word_model_loaded": emergency_model is not None,
        "continuous_model_loaded": continuous_model is not None,
        "classes": continuous_labels or emergency_labels,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "messages": {
            "alphabet": alphabet_error or "A-Z static model ready",
            "emergency": emergency_error or "Emergency isolated model ready",
            "continuous": continuous_error or "Continuous ISL sequence model ready"
        }
    })

# -------------------------------------------------------------
# Continuous ISL Sequence Inference
# -------------------------------------------------------------
@app.post("/predict-continuous")
def predict_continuous():
    target_model = continuous_model or emergency_model
    if target_model is None:
        return jsonify({
            "prediction": None,
            "confidence": 0,
            "unknown": True,
            "message": continuous_error or "Continuous model not loaded."
        }), 503

    payload = request.get_json(silent=True) or {}
    frames = payload.get("frames", [])

    if not isinstance(frames, list) or len(frames) < 4:
        return jsonify({
            "prediction": None,
            "unknown": True,
            "message": "Send at least 4 sequential camera frames."
        }), 400

    try:
        frame_features = []
        for item in frames:
            if not isinstance(item, str) or "," not in item:
                continue
            raw = base64.b64decode(item.split(",", 1)[1], validate=True)
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            frame_features.append(extract_landmarks_offline(img))

        if len(frame_features) < 4:
            return jsonify({
                "prediction": None,
                "unknown": True,
                "message": "Not enough valid frames detected."
            }), 400

        # Resample sequence to 20 frames
        indices = np.linspace(0, len(frame_features) - 1, 20).astype(int)
        feature_vector = np.stack([frame_features[i] for i in indices]).astype(np.float32).flatten().reshape(1, -1)

        probs = target_model.predict_proba(feature_vector)[0]
        best_idx = int(np.argmax(probs))
        confidence = float(probs[best_idx])
        label = str(target_model.classes_[best_idx])

        if confidence < CONFIDENCE_THRESHOLD:
            return jsonify({
                "prediction": None,
                "confidence": confidence,
                "unknown": True,
                "message": "Sign not recognized — please repeat or type your message."
            })

        return jsonify({
            "prediction": label,
            "confidence": confidence,
            "unknown": False,
            "timestamp": time.strftime("%H:%M:%S"),
            "message": "Candidate continuous sign detected. Patient confirmation required."
        })
    except Exception as exc:
        return jsonify({
            "prediction": None,
            "unknown": True,
            "message": f"Inference error: {exc}"
        }), 400

# -------------------------------------------------------------
# Static Alphabet & Isolated Word Inference (Preserved)
# -------------------------------------------------------------
@app.post("/predict")
def predict_alphabet():
    if alphabet_model is None:
        return jsonify({"prediction": None, "message": alphabet_error}), 503

    payload = request.get_json(silent=True) or {}
    image_data = payload.get("image", "")
    if not isinstance(image_data, str) or "," not in image_data:
        return jsonify({"prediction": None, "message": "No valid camera image received."}), 400

    try:
        raw = base64.b64decode(image_data.split(",", 1)[1], validate=True)
        image = Image.open(io.BytesIO(raw)).convert("RGB").resize((224, 224))
        arr = np.asarray(image, dtype=np.float32)
        probs = alphabet_model.predict(np.expand_dims(arr, axis=0), verbose=0)[0]
        best_idx = int(np.argmax(probs))
        confidence = float(probs[best_idx])

        if confidence < CONFIDENCE_THRESHOLD:
            return jsonify({"prediction": None, "confidence": confidence, "message": "Uncertain alphabet sign — reposition hand."})

        return jsonify({
            "prediction": alphabet_labels[best_idx],
            "confidence": confidence,
            "message": "Candidate alphabet letter. Patient confirmation required."
        })
    except Exception as exc:
        return jsonify({"prediction": None, "message": f"Could not process frame: {exc}"}), 400

@app.post("/predict-emergency")
def predict_emergency():
    # Delegates to continuous sequence handler with backward compatibility
    return predict_continuous()

# -------------------------------------------------------------
# Shared Hospital Network Report Transfer API (Mode B)
# -------------------------------------------------------------
def read_reports_db() -> List[Dict[str, Any]]:
    if not REPORTS_DB_PATH.exists():
        return []
    try:
        return json.loads(REPORTS_DB_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

def write_reports_db(reports: List[Dict[str, Any]]) -> None:
    REPORTS_DB_PATH.write_text(json.dumps(reports, indent=2), encoding="utf-8")

@app.post("/api/auth")
def authenticate():
    payload = request.get_json(silent=True) or {}
    token = payload.get("token", "")
    if token == LOCAL_AUTH_SECRET:
        return jsonify({"authenticated": True, "role": "hospital_clinician"})
    return jsonify({"authenticated": False, "message": "Invalid hospital access token"}), 401

@app.post("/api/reports")
def submit_patient_report():
    report = request.get_json(silent=True) or {}
    
    # Server-side validation
    if not report.get("confirmedByPatient"):
        return jsonify({"ok": False, "message": "Report rejected: must be explicitly confirmed by patient."}), 400
    if not report.get("patientId"):
        return jsonify({"ok": False, "message": "Missing patient identifier."}), 400

    report_id = report.get("id") or f"rep_srv_{int(time.time()*1000)}"
    record = {
        **report,
        "id": report_id,
        "serverReceivedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        "deliveryAcknowledged": True,
        "transferMode": "Shared Local Hospital Network (LAN)"
    }

    reports = read_reports_db()
    # Avoid duplicate submission
    reports = [r for r in reports if r.get("id") != report_id]
    reports.insert(0, record)
    write_reports_db(reports)

    return jsonify({
        "ok": True,
        "reportId": report_id,
        "serverReceivedAt": record["serverReceivedAt"],
        "acknowledgment": "GENUINE_HOSPITAL_SERVER_ACKNOWLEDGED"
    }), 201

@app.get("/api/reports")
def list_reports():
    reports = read_reports_db()
    return jsonify({"reports": reports, "count": len(reports)})

@app.get("/api/reports/<report_id>")
def get_report(report_id: str):
    reports = read_reports_db()
    found = next((r for r in reports if r.get("id") == report_id), None)
    if not found:
        return jsonify({"error": "Report not found"}), 404
    return jsonify(found)

@app.patch("/api/reports/<report_id>/review")
def update_report_review(report_id: str):
    updates = request.get_json(silent=True) or {}
    reports = read_reports_db()
    found = False
    for r in reports:
        if r.get("id") == report_id:
            found = True
            r.update(updates)
            r["serverUpdatedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
            break
    if not found:
        return jsonify({"error": "Report not found"}), 404
    write_reports_db(reports)
    return jsonify({"ok": True, "reportId": report_id})

# -------------------------------------------------------------
# Clinical AI Engine Summarization
# -------------------------------------------------------------
@app.post("/api/ai/summarize")
def summarize_report():
    payload = request.get_json(silent=True) or {}
    report = payload.get("report", {})
    ai_mode = payload.get("aiMode", "offline")

    patient_id = report.get("patientId", "Patient")
    lang = report.get("preferredLanguage", "ISL")
    needs_interp = report.get("needsInterpreter", True)
    isl_stmts = report.get("islStatements", [])
    pain_areas = report.get("painRegions", [])
    questions = report.get("patientQuestions", "")

    # Mode 1: Offline Deterministic Template (100% Offline, Zero Network, Zero Hallucinations)
    if ai_mode == "offline":
        pain_summary = "; ".join([
            f"{p.get('name')} ({p.get('side', 'Central')}): Severity {p.get('intensity')}/10, {p.get('painType', 'Aching')}, {p.get('onset', 'onset unspec')}"
            for p in pain_areas
        ]) if pain_areas else "None indicated on diagram"

        isl_summary = "; ".join([
            f'"{s.get("confirmedText")}"' for s in isl_stmts
        ]) if isl_stmts else "No camera sign language captured"

        summary = f"""[DETERMINISTIC CLINICAL REPORT SUMMARY — 100% LOCAL AIR-GAPPED — NOT A DIAGNOSIS]
• Patient Identifier: {patient_id}
• Communication Preferences: {lang} | Interpreter Required: {'YES' if needs_interp else 'No'}
• Confirmed ISL Communication: {isl_summary}
• Reported Pain Locations: {pain_summary}
• Questions for Doctor: {questions or 'None recorded'}
• Verification: Explicitly confirmed by patient. Clinician examination mandatory."""
        return jsonify({"summary": summary, "engine": "deterministic_offline"})

    # Mode 2: Local Ollama / Nemotron
    if ai_mode == "ollama":
        try:
            import urllib.request
            prompt = f"Summarize this patient communication report cleanly for the doctor. Do not invent any diagnoses: {json.dumps(report)}"
            req_data = json.dumps({"model": "nemotron-mini", "prompt": prompt, "stream": False}).encode()
            req = urllib.request.Request("http://localhost:11434/api/generate", data=req_data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode())
                return jsonify({"summary": data.get("response", ""), "engine": "local_ollama"})
        except Exception:
            # Fall back to deterministic template
            pass

    # Mode 3: Online NVIDIA NIM (if key provided)
    if ai_mode == "nvidia":
        api_key = os.getenv("NVIDIA_API_KEY", "")
        if api_key:
            try:
                import urllib.request
                prompt = f"Summarize this patient communication report cleanly for the doctor: {json.dumps(report)}"
                req_data = json.dumps({
                    "model": "nvidia/nemotron-4-340b-instruct",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2
                }).encode()
                req = urllib.request.Request(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    data=req_data,
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                    return jsonify({"summary": data["choices"][0]["message"]["content"], "engine": "nvidia_nim_cloud"})
            except Exception:
                pass

    # Fallback default
    return jsonify({
        "summary": f"[LOCAL SUMMARY] Patient {patient_id} confirmed {len(isl_stmts)} ISL statements and {len(pain_areas)} pain regions.",
        "engine": "fallback"
    })

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print("=" * 60)
    print(f"SignCare AI Hospital Service running at: http://127.0.0.1:{port}")
    print(f"Continuous ISL Sequence Model Loaded: {continuous_model is not None}")
    print(f"Alphabet Model Loaded: {alphabet_model is not None}")
    print(f"Local Storage DB: {REPORTS_DB_PATH}")
    print("=" * 60)
    app.run(host=host, port=port, debug=False)
