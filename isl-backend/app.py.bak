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
import hmac
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
from hand_landmarks import HandLandmarkExtractor, PREPROCESSING

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

CONTINUOUS_MODEL_PATH = MODELS_DIR / "real_isl" / "isl_isolated.joblib"
CONTINUOUS_LABELS_PATH = MODELS_DIR / "real_isl" / "labels.json"
CONTINUOUS_META_PATH = MODELS_DIR / "real_isl" / "metadata.json"

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
continuous_error = "No validated real ISL model installed. Add licensed videos, then run train_continuous_model.py."
detector_error = ""

CONFIDENCE_THRESHOLD = float(os.getenv("ISL_CONFIDENCE_THRESHOLD", "0.65"))
LOCAL_AUTH_SECRET = os.getenv("HOSPITAL_AUTH_SECRET", "")
landmark_extractor = None

def load_models() -> None:
    global alphabet_model, alphabet_labels, alphabet_error
    global emergency_model, emergency_labels, emergency_error
    global continuous_model, continuous_labels, continuous_meta, continuous_error, landmark_extractor, detector_error, CONFIDENCE_THRESHOLD

    try:
        landmark_extractor = HandLandmarkExtractor()
        detector_error = ""
    except Exception as exc:
        landmark_extractor = None
        detector_error = str(exc)

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

    # Production isolated-sign model. Legacy/calibration files are intentionally ignored.
    if CONTINUOUS_MODEL_PATH.exists() and CONTINUOUS_LABELS_PATH.exists():
        try:
            candidate_meta = json.loads(CONTINUOUS_META_PATH.read_text(encoding="utf-8"))
            if candidate_meta.get("is_calibration_baseline") is True:
                raise ValueError("Calibration artifact rejected for production inference.")
            if candidate_meta.get("preprocessing") != PREPROCESSING:
                raise ValueError("Model preprocessing does not match installed inference pipeline.")
            continuous_model = joblib.load(CONTINUOUS_MODEL_PATH)
            continuous_labels = json.loads(CONTINUOUS_LABELS_PATH.read_text(encoding="utf-8"))
            continuous_meta = candidate_meta
            if "ISL_CONFIDENCE_THRESHOLD" not in os.environ:
                CONFIDENCE_THRESHOLD = float(candidate_meta.get("confidence_threshold", CONFIDENCE_THRESHOLD))
            if landmark_extractor is None:
                raise RuntimeError(detector_error or "MediaPipe detector unavailable.")
            continuous_error = ""
        except Exception as exc:
            continuous_model = None
            continuous_error = f"Error loading continuous sequence model: {exc}"

def extract_landmarks_offline(image: Image.Image) -> np.ndarray | None:
    """Return genuine MediaPipe landmarks or None when no hand was detected."""
    if landmark_extractor is None:
        return None
    frame = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    return landmark_extractor.extract(frame)

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
        "continuous_model_status": "ready" if continuous_model is not None else "model_not_ready",
        "landmark_detector_status": "ready" if landmark_extractor is not None else "unavailable",
        "classes": continuous_labels,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "messages": {
            "alphabet": alphabet_error or "A-Z static model ready",
            "emergency": emergency_error or "Emergency isolated model ready",
            "continuous": continuous_error or "Continuous ISL sequence model ready",
            "landmark_detector": detector_error or "MediaPipe Hands ready"
        }
    })

# -------------------------------------------------------------
# Continuous ISL Sequence Inference
# -------------------------------------------------------------
@app.post("/predict-continuous")
def predict_continuous():
    target_model = continuous_model
    if target_model is None:
        return jsonify({
            "status": "model_not_ready",
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
            features = extract_landmarks_offline(img)
            if features is not None:
                frame_features.append(features)

        if len(frame_features) < 4:
            return jsonify({
                "prediction": None,
                "unknown": True,
                "message": "No hands detected in enough frames. Check lighting, framing, and MediaPipe setup.",
                "status": "detector_no_hands"
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
            "confidence_threshold": CONFIDENCE_THRESHOLD,
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
    if LOCAL_AUTH_SECRET and isinstance(token, str) and hmac.compare_digest(token, LOCAL_AUTH_SECRET):
        return jsonify({"authenticated": True, "role": "hospital_clinician"})
    if not LOCAL_AUTH_SECRET:
        return jsonify({"authenticated": False, "message": "Set HOSPITAL_AUTH_SECRET before enabling clinician access."}), 503
    return jsonify({"authenticated": False, "message": "Invalid hospital access token"}), 401

def clinician_authorized() -> bool:
    token = request.headers.get("Authorization", "")
    supplied = token[7:] if token.startswith("Bearer ") else ""
    return bool(LOCAL_AUTH_SECRET and supplied and hmac.compare_digest(supplied, LOCAL_AUTH_SECRET))

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
    if not clinician_authorized():
        return jsonify({"error": "Clinician authentication required."}), 401
    reports = read_reports_db()
    return jsonify({"reports": reports, "count": len(reports)})

@app.get("/api/reports/<report_id>")
def get_report(report_id: str):
    if not clinician_authorized():
        return jsonify({"error": "Clinician authentication required."}), 401
    reports = read_reports_db()
    found = next((r for r in reports if r.get("id") == report_id), None)
    if not found:
        return jsonify({"error": "Report not found"}), 404
    return jsonify(found)

@app.patch("/api/reports/<report_id>/review")
def update_report_review(report_id: str):
    if not clinician_authorized():
        return jsonify({"error": "Clinician authentication required."}), 401
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
    return summarize_report_request(payload)

def summarize_report_request(payload):
    report = payload.get("report", {})
    ai_mode = payload.get("aiMode", "offline")
    if not isinstance(report, dict):
        return jsonify({"status": "error", "error_code": "invalid_report", "error": "Report must be an object."}), 400
    statements = report.get("islStatements", []) if isinstance(report.get("islStatements", []), list) else []
    pains = report.get("painRegions", []) if isinstance(report.get("painRegions", []), list) else []
    safe = {
        "confirmed_signs": [str(s.get("confirmedText", ""))[:300] for s in statements if isinstance(s, dict) and s.get("confirmedText")],
        "pain_regions": [{k: p.get(k) for k in ("name", "side", "intensity", "painType", "onset", "notes") if k in p} for p in pains if isinstance(p, dict)],
        "patient_questions": str(report.get("patientQuestions", ""))[:1000],
    }
    def result(engine, model, content):
        return jsonify({"status": "ok", "engine": engine, "model": model, "content": content, "fallback_used": False})
    if ai_mode == "offline":
        pain_text = "; ".join(f"{p.get('name')} ({p.get('side', 'Central')}): {p.get('intensity')}/10 {p.get('painType', '')} {p.get('onset', '')}" for p in safe["pain_regions"]) or "None indicated"
        signs_text = "; ".join(safe["confirmed_signs"]) or "No confirmed statements"
        return result("offline_template", "deterministic", f"Offline communication aid summary (not a diagnosis)\nConfirmed statements: {signs_text}\nReported pain: {pain_text}\nQuestions: {safe['patient_questions'] or 'None recorded'}")
    if ai_mode == "disabled":
        return result("manual", None, "")
    if ai_mode == "nvidia" and payload.get("externalAiConsent") is not True:
        return jsonify({"status": "consent_required", "engine": "online_nvidia", "content": "", "fallback_used": False, "error_code": "consent_required"}), 403
    if ai_mode == "nvidia" and not os.getenv("NVIDIA_API_KEY"):
        return jsonify({"status": "error", "engine": "online_nvidia", "content": "", "fallback_used": False, "error_code": "api_key_missing", "error": "NVIDIA_API_KEY is not configured on the backend."}), 503
    try:
        import urllib.request
        model = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-4-340b-instruct") if ai_mode == "nvidia" else os.getenv("LOCAL_AI_MODEL", "nemotron-mini")
        prompt = f"Summarize these patient communication notes. Do not diagnose or recommend treatment: {json.dumps(safe)}"
        if ai_mode == "nvidia":
            body = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2}
            url = "https://integrate.api.nvidia.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {os.getenv('NVIDIA_API_KEY')}", "Content-Type": "application/json"}
        elif ai_mode == "ollama":
            body = {"model": model, "prompt": prompt, "stream": False}
            url = os.getenv("LOCAL_AI_URL", "http://localhost:11434/api/generate")
            headers = {"Content-Type": "application/json"}
        else:
            return jsonify({"status": "error", "engine": "manual", "content": "", "fallback_used": False, "error_code": "unsupported_mode"}), 400
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
        content = data["choices"][0]["message"]["content"] if ai_mode == "nvidia" else data.get("response", "")
        if not content:
            raise ValueError("AI service returned empty content.")
        return result("online_nvidia" if ai_mode == "nvidia" else "local_model", model, content)
    except Exception as exc:
        engine = "online_nvidia" if ai_mode == "nvidia" else "local_model"
        return jsonify({"status": "error", "engine": engine, "content": "", "fallback_used": False, "error_code": "upstream_error", "error": str(exc)}), 502

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
