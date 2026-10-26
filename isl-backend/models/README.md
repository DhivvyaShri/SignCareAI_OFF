# Model files

Production artifacts are stored only under `real_isl/` after provenance-checked training. The files under `calibration/` are synthetic calibration artifacts retained for audit/history; they are never loaded by production inference and their metrics are not real recognition results.

Do not claim recognition is active until `/health` reports `continuous_model_status: ready` for a model with compatible MediaPipe preprocessing.
