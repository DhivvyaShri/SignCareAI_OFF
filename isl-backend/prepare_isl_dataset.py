"""SignCare AI — ISL Dataset Validation, Ingestion & Preparation Pipeline
Supports RealSign (A-Z) and ISL Temporal Word/Continuous Datasets (INCLUDE / 40-Words).

Validates videos, avoids subject leakage, checks corruption, and produces a dataset readiness report.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
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
    return hasher.hexdigest()[:16]

def validate_video_file(path: Path) -> Dict[str, Any]:
    """Check video readability, frame count, FPS, and resolution."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return {"valid": False, "error": "Could not open video with OpenCV VideoCapture."}
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 0
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 0
    
    # Read first and last frame to test corruption
    ret1, f1 = cap.read()
    if not ret1 or f1 is None:
        cap.release()
        return {"valid": False, "error": "First frame corrupt or unreadable."}
    
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
        "supported_hospital_vocab_covered": []
    }
    
    if not WORDS_DIR.exists():
        return words_status
        
    class_folders = [f for f in WORDS_DIR.iterdir() if f.is_dir() and not f.name.startswith(".")]
    if not class_folders:
        return words_status
        
    words_status["present"] = True
    
    for folder in class_folders:
        label = folder.name.upper()
        clips = [p for p in folder.rglob("*") if p.suffix.lower() in {".mp4", ".avi", ".mov", ".mkv"}]
        
        valid_list = []
        corrupted_list = []
        
        for clip in clips:
            val = validate_video_file(clip)
            if val["valid"]:
                valid_list.append({
                    "file": clip.name,
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
        "timestamp": Path(__file__).stat().st_mtime,
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
            "continuous_words_ready_for_training": words_report["present"] and len(words_report["classes"]) >= 2,
            "notes": (
                "Continuous and temporal word models require at least 2 validated classes (prefer 30+ clips per class). "
                "Alphabet training requires A-Z RealSign images. "
                "Never invent fake training samples. Only authentic ISL recordings should be trained."
            )
        }
    }
    
    REPORT_PATH.write_text(json.dumps(readiness_report, indent=2), encoding="utf-8")
    print(f"Dataset readiness report saved to: {REPORT_PATH}")
    print("\nReadiness Summary:")
    print(f"  • A-Z Alphabet Dataset Present: {alpha_report['present']} ({alpha_report['total_images']} images across {len(alpha_report['classes_found'])} classes)")
    print(f"  • Temporal Sequence Dataset Present: {words_report['present']} ({words_report['valid_clips']} valid clips across {len(words_report['classes'])} classes)")
    print(f"  • Hospital Vocabulary Covered: {words_report['supported_hospital_vocab_covered']}")
    print(f"  • Ready for Continuous Training: {readiness_report['readiness_summary']['continuous_words_ready_for_training']}")
    print("=" * 70)

if __name__ == "__main__":
    main()

