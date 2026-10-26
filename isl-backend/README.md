# SignCare AI backend

The Flask backend serves the existing patient/doctor application, local report endpoints, and optional AI summarization. ISL inference is unavailable until a genuine compatible model has been trained and installed. The historic files in `models/` are calibration artifacts and are ignored by production inference.

## Windows PowerShell setup

```powershell
cd isl-backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python download_isl_dataset.py --repo vidit031/isl-isolated-40words
python prepare_isl_dataset.py --auto-create-folders
```

The downloader retrieves the dataset card and metadata files only. The 40-word repository is a 642-row, 40-label metadata index that aggregates several source datasets with different provenance and terms; it is not a single redistributable video archive. Inspect `dataset/sources/vidit031__isl-isolated-40words/source_inventory.json` and the retained card/metadata. Obtain each source's actual video files using that source's documented process and license. Do not treat the aggregate `multi-source-aggregate` marker as a blanket license.

`ai4bharat/INCLUDE` on Hugging Face contains metadata about 3.82k video records, not the video bytes; its card points to Zenodo record 4010759 and provides a download script. The listed Hugging Face card says CC-BY-4.0. `Exploration-Lab/iSign` requires accepting the repository's access terms and is CC-BY-NC-SA-4.0; it documents split video/pose files and is research-only. Neither source is imported automatically.

## Prepare and train

Place licensed, genuine isolated-sign video clips under `dataset/words/<LABEL>/`. Keep original files there; do not put generated artifacts in the source folders. Copy `dataset_manifest.example.json` to `dataset/dataset_manifest.json` and complete it after checking all source terms; set `reviewed_use_terms` to true only after that review:

```json
{
  "source": "Original dataset and version",
  "license": "Exact applicable license or documented permission",
  "attribution": "Required attribution",
  "source_url": "https://...",
  "signer_metadata": "available or unavailable",
  "reviewed_use_terms": true
}
```

Then run:

```powershell
python prepare_isl_dataset.py
```

The readiness report lists readable/corrupt clips, class counts, exact duplicate files, missing target labels, and signer metadata availability. Empty folders are not counted as data. Install the MediaPipe package from requirements before feature extraction. Training and inference share `hand_landmarks.py`; it uses local MediaPipe Hands landmarks and rejects frames where no hand is detected.

```powershell
python train_continuous_model.py
python evaluate_isl_model.py
```

Training requires at least five clips per class in two or more classes, a provenance manifest, and MediaPipe. It makes train/validation/test partitions and uses signer-grouped partitions when every clip has verified signer metadata (at least three signers per class); otherwise it explicitly reports signer independence is not guaranteed. A conservative confidence threshold is selected from validation results when support permits. Treat metrics as exploratory and not clinical or deployment validation. Artifacts are placed in `models/real_isl/`; calibration files remain under `models/calibration/`. The Flask health endpoint says `model_not_ready` until a compatible genuine model loads.

MediaPipe's pip package supplies its local Hands detector asset for this legacy Solutions API. If MediaPipe cannot initialize, the backend reports that the detector/model is unavailable; no contour-derived points are substituted.

## Run the service

Set secrets in the process environment before starting Flask; do not put them in Vite variables or frontend code:

```powershell
$env:HOSPITAL_AUTH_SECRET = 'use-a-long-random-secret'
# Optional hosted AI:
$env:NVIDIA_API_KEY = 'your-key'
python app.py
```

The default URL is `http://127.0.0.1:8000`. `/health` reports model readiness. Clinician report list/read/review endpoints require `Authorization: Bearer <HOSPITAL_AUTH_SECRET>`. Patient submission still requires explicit report confirmation; the application must be deployed behind a secured hospital network/reverse proxy. For offline summaries select Offline Local Mode. Hosted NVIDIA summaries require explicit consent each time and send only the summary fields (confirmed sign text, selected pain fields, and patient question text), without the patient identifier or camera frames. Failures return an error; they are not represented as successful AI output.

Frontend setup is from the repository root: `npm install`, then `npm run dev`; use `npm run build` for a production bundle. Set `VITE_API_URL` to the Flask service URL in the frontend environment. Never place API secrets in `VITE_*` variables.
