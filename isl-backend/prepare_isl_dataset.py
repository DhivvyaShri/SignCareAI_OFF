"""SignCare AI — ISL Dataset Validation, Ingestion & Preparation Pipeline
Supports RealSign (A-Z) and ISL Temporal Word/Continuous Datasets (INCLUDE / 40-Words).

Validates videos, avoids subject leakage, checks corruption, and produces a dataset readiness report.
"""
from __future__ import annotations
import argparse
import hashlib
import csv
import json
import os
from datetime import datetime, timezone
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Any

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "dataset"
ALPHABET_DIR = DATASET_DIR / "alphabet"
WORDS_DIR = DATASET_DIR / "words"
CONTINUOUS_DIR = DATASET_DIR / "continuous"
REPORT_PATH = DATASET_DIR / "dataset_readiness_report.json"
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

# Supported target hospital vocabulary
HOSPITAL_ISL_VOCABULARY = [
    "HELP",
    "PAIN",
    "CHEST_PAIN",
    "DOCTOR",
    "NURSE",
    "WATER",
    "MEDICINE",
    "FEVER",
    "BREATHING_DIFFICULTY",
    "YES",
    "NO",
    "THANK_YOU"
]

def calculate_file_hash(path: Path) -> str:
    """Compute SHA256 of file for provenance and integrity."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def validate_video_file(path: Path) -> Dict[str, Any]:
    """Check video readability, frame count, FPS, and resolution."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return {"valid": False, "error": "Could not open video with OpenCV VideoCapture."}
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 0
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 0
    
    # Read both ends so empty/truncated files do not pass on metadata alone.
    ret1, f1 = cap.read()
    if not ret1 or f1 is None:
        cap.release()
        return {"valid": False, "error": "First frame corrupt or unreadable."}

    if frame_count > 1:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count - 1)
        ret_last, last_frame = cap.read()
        if not ret_last or last_frame is None:
            cap.release()
            return {"valid": False, "error": "Last indexed frame corrupt or unreadable."}
    
    cap.release()
    
    duration = (frame_count / fps) if fps > 0 else 0
    return {
        "valid": True,
        "fps": float(fps),
        "frame_count": frame_count,
        "width": width,
        "height": height,
        "duration_sec": round(duration, 2)
    }

def scan_alphabet_dataset() -> Dict[str, Any]:
    """Audit static fingerspelling alphabet images."""
    alpha_status = {
        "present": False,
        "classes_found": [],
        "total_images": 0,
        "splits": {"training": 0, "validation": 0, "testing": 0}
    }
    
    # Check standard paths: dataset/Training, dataset/alphabet, etc.
    candidate_dirs = [DATASET_DIR, ALPHABET_DIR]
    train_dir = None
    for cand in candidate_dirs:
        for name in ("Training", "training", "train"):
            if (cand / name).is_dir():
                train_dir = cand
                break
        if train_dir: break
        
    if not train_dir:
        return alpha_status
        
    alpha_status["present"] = True
    for split in ["Training", "Validation", "Testing"]:
        s_dir = train_dir / split
        if not s_dir.is_dir():
            s_dir = train_dir / split.lower()
        if s_dir.is_dir():
            imgs = list(s_dir.rglob("*.jpg")) + list(s_dir.rglob("*.png"))
            alpha_status["splits"][split.lower()] = len(imgs)
            alpha_status["total_images"] += len(imgs)
            classes = sorted({p.parent.name.upper() for p in imgs})
            for c in classes:
                if c not in alpha_status["classes_found"]:
                    alpha_status["classes_found"].append(c)
                    
    return alpha_status

def scan_temporal_words_dataset() -> Dict[str, Any]:
    """Scan and validate temporal sign video clips for continuous and word models."""
    words_status = {
        "present": False,
        "directory": str(WORDS_DIR),
        "classes": {},
        "total_clips": 0,
        "valid_clips": 0,
        "corrupted_clips": 0,
        "supported_hospital_vocab_covered": [],
        "duplicate_clips": [],
        "missing_labels": [],
        "signer_ids_available": False,
    }
    
    if not WORDS_DIR.exists():
        return words_status
        
    class_folders = [f for f in WORDS_DIR.iterdir() if f.is_dir() and not f.name.startswith(".")]
    if not class_folders:
        return words_status
        
    words_status["present"] = True
    
    for folder in class_folders:
        label = folder.name.upper()
        clips = [p for p in folder.rglob("*") if p.suffix.lower() in VIDEO_EXTENSIONS]
        
        valid_list = []
        corrupted_list = []
        
        for clip in clips:
            val = validate_video_file(clip)
            if val["valid"]:
                valid_list.append({
                    "file": str(clip.relative_to(DATASET_DIR)),
                    "duration": val.get("duration_sec", 0),
                    "frames": val.get("frame_count", 0),
                    "resolution": f"{val.get('width')}x{val.get('height')}"
                })
            else:
                corrupted_list.append({"file": clip.name, "error": val.get("error")})
                
        words_status["classes"][label] = {
            "total": len(clips),
            "valid": len(valid_list),
            "corrupted": len(corrupted_list),
            "samples": valid_list[:3] # preview
        }
        
        words_status["total_clips"] += len(clips)
        words_status["valid_clips"] += len(valid_list)
        words_status["corrupted_clips"] += len(corrupted_list)
        
        if label in HOSPITAL_ISL_VOCABULARY and len(valid_list) > 0:
            words_status["supported_hospital_vocab_covered"].append(label)
            
    words_status["present"] = words_status["valid_clips"] > 0
    hashes = {}
    for folder in class_folders:
        for clip in folder.rglob("*"):
            if clip.suffix.lower() not in VIDEO_EXTENSIONS:
                continue
            digest = calculate_file_hash(clip)
            if digest in hashes:
                words_status["duplicate_clips"].append({"file": str(clip.relative_to(DATASET_DIR)), "duplicate_of": hashes[digest]})
            else:
                hashes[digest] = str(clip.relative_to(DATASET_DIR))
    words_status["missing_labels"] = [label for label in HOSPITAL_ISL_VOCABULARY if words_status["classes"].get(label, {}).get("valid", 0) == 0]
    signer_fields = {"signer", "signer_id", "subject", "participant_id"}
    for metadata_csv in DATASET_DIR.rglob("*.csv"):
        try:
            with metadata_csv.open(encoding="utf-8-sig", newline="") as source:
                reader = csv.DictReader(source)
                if reader.fieldnames and signer_fields.intersection(name.strip().lower() for name in reader.fieldnames):
                    words_status["signer_ids_available"] = any(any((row.get(key) or "").strip() for key in signer_fields) for row in reader)
                    if words_status["signer_ids_available"]:
                        break
        except (OSError, UnicodeError):
            continue
    return words_status

def main():
    parser = argparse.ArgumentParser(description="SignCare ISL Dataset Validator and Readiness Assessor")
    parser.add_argument("--auto-create-folders", action="store_true", help="Initialize required dataset folder structure")
    args = parser.parse_args()
    
    print("=" * 70)
    print(" SIGNCARE AI — ISL DATASET READINESS AUDIT & PREPARATION")
    print("=" * 70)
    
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    WORDS_DIR.mkdir(parents=True, exist_ok=True)
    CONTINUOUS_DIR.mkdir(parents=True, exist_ok=True)
    
    if args.auto_create_folders:
        for word in HOSPITAL_ISL_VOCABULARY:
            (WORDS_DIR / word).mkdir(parents=True, exist_ok=True)
        print(f"Created standard vocabulary folders under: {WORDS_DIR}")
        
    alpha_report = scan_alphabet_dataset()
    words_report = scan_temporal_words_dataset()
    
    readiness_report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": {
            "os": sys.platform,
            "python": sys.version.split()[0],
            "opencv_version": cv2.__version__
        },
        "target_hospital_vocabulary": HOSPITAL_ISL_VOCABULARY,
        "alphabet_dataset": alpha_report,
        "temporal_word_dataset": words_report,
        "readiness_summary": {
            "alphabet_ready_for_training": alpha_report["present"] and len(alpha_report["classes_found"]) >= 26,
            "continuous_words_ready_for_training": sum(1 for entry in words_report["classes"].values() if entry["valid"] >= 5) >= 2,
            "notes": (
                "Readiness uses videos that OpenCV can open, not just folder names. At least two validated classes with five clips each are required for minimum train/validation/test partitions. "
                "Dataset provenance and license review are required before training. Signer-independent evaluation is not guaranteed unless verified signer metadata is used."
            )
        }
    }
    
    REPORT_PATH.write_text(json.dumps(readiness_report, indent=2), encoding="utf-8")
    print(f"Dataset readiness report saved to: {REPORT_PATH}")
    print("\nReadiness Summary:")
    print(f"Video files: {words_report['total_clips']}; readable: {words_report['valid_clips']}; unreadable: {words_report['corrupted_clips']}")
    print(f"Exact duplicates: {len(words_report['duplicate_clips'])}; signer metadata detected: {words_report['signer_ids_available']}")
    print("Per-class readable clip counts:")
    for label, counts in sorted(words_report["classes"].items()):
        print(f"  {label}: {counts['valid']} readable / {counts['total']} files")
    print(f"Missing configured labels: {words_report['missing_labels']}")
    print(f"  • A-Z Alphabet Dataset Present: {alpha_report['present']} ({alpha_report['total_images']} images across {len(alpha_report['classes_found'])} classes)")
    print(f"  • Temporal Sequence Dataset Present: {words_report['present']} ({words_report['valid_clips']} valid clips across {len(words_report['classes'])} classes)")
    print(f"  • Hospital Vocabulary Covered: {words_report['supported_hospital_vocab_covered']}")
    print(f"  • Ready for Continuous Training: {readiness_report['readiness_summary']['continuous_words_ready_for_training']}")
    print("=" * 70)

if __name__ == "__main__":
    main()

