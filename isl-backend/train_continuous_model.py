"""Train a real isolated-sign classifier from labeled video clips only."""
from __future__ import annotations

import json
import time
import csv
from pathlib import Path

import cv2
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split, GroupShuffleSplit

from hand_landmarks import FEATURES_PER_FRAME, HandLandmarkExtractor, PREPROCESSING

ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "dataset" / "words"
MODEL_DIR = ROOT / "models" / "real_isl"
EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
SEQUENCE_LENGTH = 20


def video_features(path: Path, detector: HandLandmarkExtractor) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return None
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if count < 1:
        cap.release()
        return None
    targets = set(np.linspace(0, count - 1, SEQUENCE_LENGTH).astype(int).tolist())
    frames, index = [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if index in targets:
            feature = detector.extract(frame)
            if feature is not None:
                frames.append((index, feature))
        index += 1
    cap.release()
    if len(frames) < max(4, SEQUENCE_LENGTH // 3):
        return None
    selected = np.linspace(0, len(frames) - 1, SEQUENCE_LENGTH).astype(int)
    return np.stack([frames[i][1] for i in selected]).reshape(-1)


def main() -> None:
    classes = sorted(p for p in DATASET.iterdir() if p.is_dir()) if DATASET.exists() else []
    if len(classes) < 2:
        raise SystemExit(f"Not enough labeled classes under {DATASET}. Import verified real videos first.")
    clip_paths = [path for folder in classes for path in folder.rglob("*") if path.suffix.lower() in EXTENSIONS]
    if not clip_paths:
        raise SystemExit(f"No genuine labeled video clips found under {DATASET}. Training was not run.")
    manifest_path = ROOT / "dataset" / "dataset_manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else {}
    if not manifest.get("source") or not manifest.get("license") or manifest.get("reviewed_use_terms") is not True:
        raise SystemExit("Dataset provenance/terms not verified. Complete dataset_manifest.example.json, set reviewed_use_terms=true after reviewing every source license, and save it as dataset/dataset_manifest.json.")

    signer_by_name = {}
    for metadata_csv in (ROOT / "dataset").rglob("*.csv"):
        try:
            with metadata_csv.open(encoding="utf-8-sig", newline="") as source:
                for row in csv.DictReader(source):
                    clip_key = next((row.get(key) for key in ("video_path", "original_filename", "filename", "file") if row.get(key)), None)
                    signer = next((row.get(key) for key in ("signer", "signer_id", "subject", "participant_id") if row.get(key)), None)
                    if clip_key and signer:
                        signer_by_name[Path(clip_key.replace("\\", "/")).name] = str(signer)
        except (OSError, UnicodeError):
            continue
    X, y, files, signers = [], [], [], []
    detector = HandLandmarkExtractor()
    try:
        for folder in classes:
            valid = 0
            for path in folder.rglob("*"):
                if path.suffix.lower() not in EXTENSIONS:
                    continue
                row = video_features(path, detector)
                if row is not None:
                    X.append(row)
                    y.append(folder.name.upper())
                    files.append(str(path.relative_to(ROOT / "dataset")))
                    signers.append(signer_by_name.get(path.name))
                    valid += 1
            print(f"{folder.name.upper()}: {valid} usable clips")
    finally:
        detector.close()
    labels, counts = np.unique(y, return_counts=True)
    if len(labels) < 2 or min(counts, default=0) < 5:
        raise SystemExit("Training needs at least five usable clips per class in two or more classes for train/validation/test splits.")

    indices = np.arange(len(y))
    signer_split = all(signers) and all(len(set(s for label, s in zip(y, signers) if label == cls)) >= 3 for cls in labels)
    if signer_split:
        splitter = GroupShuffleSplit(n_splits=100, test_size=0.4, random_state=42)
        train_idx = val_idx = test_idx = None
        for candidate_train, candidate_holdout in splitter.split(indices, y, groups=signers):
            if set(np.asarray(y)[candidate_train]) != set(labels):
                continue
            hold_groups = np.asarray(signers)[candidate_holdout]
            hold_y = np.asarray(y)[candidate_holdout]
            inner = GroupShuffleSplit(n_splits=100, test_size=0.5, random_state=43)
            for candidate_val_rel, candidate_test_rel in inner.split(candidate_holdout, hold_y, groups=hold_groups):
                candidate_val, candidate_test = candidate_holdout[candidate_val_rel], candidate_holdout[candidate_test_rel]
                if set(np.asarray(y)[candidate_val]) == set(labels) and set(np.asarray(y)[candidate_test]) == set(labels):
                    train_idx, val_idx, test_idx = candidate_train, candidate_val, candidate_test
                    break
            if train_idx is not None:
                break
        if train_idx is None:
            raise SystemExit("Signer IDs are complete but cannot form signer-disjoint train/validation/test partitions with every class represented. Collect more signers per label.")
    else:
        train_idx, holdout_idx = train_test_split(indices, test_size=0.4, random_state=42, stratify=y)
        val_idx, test_idx = train_test_split(holdout_idx, test_size=0.5, random_state=43, stratify=np.asarray(y)[holdout_idx])
    model = RandomForestClassifier(n_estimators=300, max_depth=16, class_weight="balanced", random_state=42, n_jobs=-1)
    model.fit(np.asarray(X)[train_idx], np.asarray(y)[train_idx])
    val_probabilities = model.predict_proba(np.asarray(X)[val_idx])
    val_predictions = model.classes_[np.argmax(val_probabilities, axis=1)]
    val_confidence = np.max(val_probabilities, axis=1)
    val_correct = val_predictions == np.asarray(y)[val_idx]
    min_accepted = max(5, int(np.ceil(len(val_idx) * 0.15)))
    calibrated_threshold = None
    for threshold in sorted(set(val_confidence.tolist())):
        accepted = val_confidence >= threshold
        if int(accepted.sum()) >= min_accepted and float(val_correct[accepted].mean()) >= 0.9:
            calibrated_threshold = float(threshold)
            break
    confidence_threshold = calibrated_threshold if calibrated_threshold is not None else 0.65
    predictions = model.predict(np.asarray(X)[test_idx])
    classes_order = model.classes_.tolist()
    evaluation = {
        "status": "evaluated_on_real_video_holdout",
        "accuracy": float(accuracy_score(np.asarray(y)[test_idx], predictions)),
        "held_out_samples": len(test_idx),
        "validation_samples": len(val_idx),
        "validation_threshold": confidence_threshold,
        "threshold_selection": "lowest validation confidence achieving >=90% accuracy among >=5 accepted examples" if calibrated_threshold is not None else "validation did not meet minimum support/precision; conservative 0.65 fallback (uncalibrated)",
        "classification_report": classification_report(np.asarray(y)[test_idx], predictions, output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(np.asarray(y)[test_idx], predictions, labels=classes_order).tolist(),
        "classes": classes_order,
        "confidence_threshold": confidence_threshold,
        "test_files": [files[i] for i in test_idx],
        "signer_independent_evaluation": "grouped_by_signer across train/validation/test" if signer_split else "not_guaranteed; complete verified signer IDs were not available",
        "is_calibration_baseline": False,
    }
    metadata = {
        "status": "production_candidate",
        "model_type": "RandomForestClassifier on fixed-length MediaPipe hand landmark sequences",
        "input_shape": [SEQUENCE_LENGTH, FEATURES_PER_FRAME],
        "classes": classes_order,
        "preprocessing": PREPROCESSING,
        "dataset_provenance": manifest,
        "sample_counts": dict(zip(labels.tolist(), counts.astype(int).tolist())),
        "signer_metadata": "complete; group split used" if signer_split else "missing or incomplete; random clip split used",
        "trained_at_unix": time.time(),
        "is_calibration_baseline": False,
        "evaluation_status": evaluation["status"],
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_DIR / "isl_isolated.joblib")
    (MODEL_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (MODEL_DIR / "evaluation.json").write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    (MODEL_DIR / "labels.json").write_text(json.dumps(classes_order, indent=2), encoding="utf-8")
    print(f"Saved genuine candidate model to {MODEL_DIR}; held-out accuracy={evaluation['accuracy']:.3f} (not signer-independent).")


if __name__ == "__main__":
    main()
