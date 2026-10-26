"""Report saved held-out evaluation for the genuine isolated-sign model."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent / "models" / "real_isl"
metadata_path = root / "metadata.json"
evaluation_path = root / "evaluation.json"
if not metadata_path.exists() or not evaluation_path.exists():
    print(json.dumps({"status": "not_evaluated", "reason": "No genuine trained model/evaluation artifacts are installed."}, indent=2))
    raise SystemExit(2)
metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
if metadata.get("is_calibration_baseline") or evaluation.get("is_calibration_baseline"):
    print(json.dumps({"status": "not_evaluated", "reason": "Calibration artifact is not a real-world evaluation."}, indent=2))
    raise SystemExit(2)
print(json.dumps({"status": evaluation.get("status", "not_evaluated"), "dataset_provenance": metadata.get("dataset_provenance"), "sample_counts": metadata.get("sample_counts"), "signer_independent_evaluation": evaluation.get("signer_independent_evaluation", "not documented"), "evaluation": evaluation}, indent=2))
