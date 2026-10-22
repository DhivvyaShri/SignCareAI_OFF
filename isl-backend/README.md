# SignCare AI — Offline ISL Hospital Recognition Backend

This backend provides offline machine learning inference, continuous sign language processing, and local report exchange for the SignCare AI hospital communication platform.

---

## 1. Supported Capabilities

1. **Continuous ISL Sequence Recognition (`/predict-continuous`)**:
   - Analyzes temporal sequences (20 normalized frames) using 126 landmark features per frame (21 keypoints × 3D coordinates × 2 hands).
   - Classifies continuous hospital vocabulary:
     - `HELP`
     - `PAIN`
     - `CHEST_PAIN`
     - `DOCTOR`
     - `WATER`
     - `MEDICINE`
     - `FEVER`
     - `YES`
     - `NO`
   - Strict confidence thresholding (0.65). If below threshold, flags:
     *"Sign not recognized — please repeat or type your message."* Never guesses silently.

2. **Static Fingerspelled Alphabet Recognition (`/predict`)**:
   - Static A–Z fingerspelled image classification trained with the RealSign dataset.

3. **Isolated Emergency Signs (`/predict-emergency`)**:
   - Multi-frame emergency classifier for isolated signs.

4. **Local Hospital Report Synchronization (`/api/reports`)**:
   - Authenticated REST service allowing patient and doctor devices on the same local hospital network (LAN) to exchange confirmed reports without external internet.
   - Provides genuine server acknowledgment tokens.

5. **Clinical Communication Summarization (`/api/ai/summarize`)**:
   - **Offline Local Mode**: 100% deterministic, rule-based clinical note synthesis. Zero network requests, zero hallucination risk.
   - **Local AI Mode**: Optional integration with locally installed Ollama (`http://localhost:11434`) running Nemotron or Llama 3 models.
   - **Online Mode**: Optional hosted NVIDIA NIM API if `NVIDIA_API_KEY` is configured.

---

## 2. Windows Installation and Setup

From the project root on Windows PowerShell:

```powershell
cd isl-backend

# 1. Create a Python 3.11 virtual environment
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Dataset Preparation & Readiness Audit

Run the dataset validator to check your local folders, verify video file integrity, and generate a readiness report:

```powershell
python prepare_isl_dataset.py --auto-create-folders
```

This generates `dataset/dataset_readiness_report.json` with counts, frame rates, and missing files.

### Placing Training Data:
- **Continuous / Word Clips**: Place verified ISL `.mp4` video clips in:
  ```text
  dataset/words/
    HELP/
    PAIN/
    CHEST_PAIN/
    DOCTOR/
    WATER/
    MEDICINE/
    FEVER/
    YES/
    NO/
  ```
- **Recording Clips with Camera**: Use the included helper:
  ```powershell
  python collect_word_clips.py --label HELP --count 30
  python collect_word_clips.py --label PAIN --count 30
  ```
- **Alphabet Dataset**: Download `Dataset.zip` from the open RealSign repository:
  `https://github.com/RealSign62/RealSign-Indian-Sign-Language-Dataset` and extract into `dataset/Training/`, `dataset/Validation/`, `dataset/Testing/`.

---

## 4. Model Training

### Train Continuous Sequence Model:
```powershell
python train_continuous_model.py
```
*(If no video clips are present on first setup, add `--generate-calibration-baseline` to initialize baseline weights for offline testing).*

Output artifacts saved in `isl-backend/models/`:
- `isl_continuous_sequence.joblib`
- `continuous_labels.json`
- `continuous_metadata.json`
- `continuous_evaluation.json`

### Train Static Alphabet Model:
```powershell
python train_model.py
```

---

## 5. Starting the Local Hospital Backend

Run the Flask application:

```powershell
python app.py
```

The service starts at `http://127.0.0.1:8000`.
Visit `http://127.0.0.1:8000/health` in your browser to verify that models and endpoints are operational.
