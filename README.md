# SignCare AI — Complete Offline-First ISL Hospital Communication System

SignCare AI is a full-stack, offline-first hospital communication platform designed specifically for Deaf and hard-of-hearing patients interacting with clinicians in hospital and clinic environments.

The system combines **interactive human anatomy pain mapping**, **continuous Indian Sign Language (ISL) sequence recognition from live camera video**, **structured medical communication reporting**, and an **extensive 12-section clinician dashboard** with dual-mode report synchronization (same-device demonstration and shared local hospital LAN).

---

## 1. System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               CLIENT PWA APPLICATION                   │
                    │   React 18 + Vite · Local System Fonts (Zero CDNs)     │
                    │   Service Worker (sw.js) · Web Manifest · Offline Cache │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
         ┌───────────────────────────┐                   ┌───────────────────────────┐
         │     PATIENT DASHBOARD     │                   │     DOCTOR DASHBOARD      │
         │  • Continuous ISL Camera  │                   │  • 12 Clinical Sections   │
         │  • Anatomy Pain Map (SVG) │                   │  • Section Review Toggles │
         │  • Communication Cards    │                   │  • Clinician Notes Editor │
         │  • Patient Report Modal   │                   │  • Speech-to-Text Voice   │
         └─────────────┬─────────────┘                   └─────────────▲─────────────┘
                       │                                               │
                       ▼                                               │
         ┌───────────────────────────┐                                 │
         │     LOCAL PERSISTENCE     │                                 │
         │ IndexedDB (SignCareDB)    │───[Mode A: Same-Device Demo]────┤
         │ • Reports & Audit Logs    │                                 │
         │ • Local Sync Queue        │                                 │
         └─────────────┬─────────────┘                                 │
                       │                                               │
                       ▼                                               │
         ┌───────────────────────────┐                                 │
         │    LOCAL FLASK SERVICE    │───[Mode B: Hospital LAN Sync]───┘
         │ Port 8000 · Python 3.11   │
         │ • /predict-continuous     │
         │ • /api/reports (Auth)     │
         │ • /api/ai/summarize       │
         └───────────────────────────┘
```

- **Frontend Application**: React 18, Vite, JavaScript, CSS. Built as a Progressive Web App (PWA) with a local service worker (`sw.js`) and web manifest. Loads without internet after initial build. Zero runtime remote CDNs (local system font stack).
- **Local Persistence Layer**: Browser IndexedDB (`SignCareLocalDB`) stores patient reports, conversation logs, and offline sync queues. Handles browser reloads and page refreshes cleanly without data loss.
- **Continuous ISL Recognition Pipeline**: 10-15 FPS frame sampling, sliding-window temporal buffering (20 frames), normalized 126-feature dual-hand landmark extraction (OpenCV/MediaPipe), and sequence classifier (`isl_continuous_sequence.joblib`). Emits continuous token stream, unknown-sign warnings (< 65% confidence), in-place token editing, and patient confirmation.
- **Interactive Anatomy Pain Map**: Neutral vector SVG silhouette with Anterior (Front) and Posterior (Back) views. 17+ anatomical regions with side selection, 0–10 intensity slider, onset duration, pain type, constant/intermittent pattern, and accessible dropdown fallback.
- **Local Hospital Transfer Engine**:
  - **Mode A (Same-Device Demo)**: Instant read/write to IndexedDB; doctor view opens saved reports on the same device.
  - **Mode B (Shared Local Hospital LAN)**: Authenticated REST service (`/api/reports`) over the hospital's local WiFi/Ethernet without external internet access.
- **Clinical AI Engine**:
  - **Offline Local Mode**: 100% deterministic rule-based medical report summarization (zero network, zero hallucination).
  - **Local AI Mode**: Connects to locally installed Ollama (`http://localhost:11434`) running Nemotron or Llama 3 models.
  - **Online NVIDIA Mode**: Optional hosted NVIDIA NIM API if `NVIDIA_API_KEY` is provided.
  - **Manual Mode**: AI disabled.

---

## 2. Requirements & Prerequisites

- **Operating System**: Windows 10 or Windows 11 (64-bit).
- **Python**: Python 3.11.x (installed and available in PATH).
- **Node.js**: Node.js 18+ or 20+ (with npm).
- **Camera**: Built-in webcam or USB camera for continuous sign capture.
- **Microphone**: For clinician speech-to-text input (supported in Google Chrome / Edge).

---

## 3. Quick Start on Windows

### Step 1: Start the Local Flask Backend
Open a PowerShell terminal in the project directory:

```powershell
cd isl-backend

# 1. (Optional) Create and activate virtual environment
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Train or initialize baseline continuous sequence weights
python train_continuous_model.py --generate-calibration-baseline

# 4. Start the backend service
python app.py
```

The Flask backend starts at: `http://127.0.0.1:8000`.
Visit `http://127.0.0.1:8000/health` to confirm `continuous_model_loaded: true`.

### Step 2: Start the React Frontend Application
Open a **second** PowerShell terminal in the project root:

```powershell
# 1. Install frontend packages (if not already installed)
npm install

# 2. Build or start development server
npm run dev
```

Vite will print the local application URL: `http://localhost:5173`. Open this URL in Google Chrome or Microsoft Edge.

---

## 4. Key Workflows & Step-by-Step Testing

### Patient Workflow:
1. Open `http://localhost:5173` → click **Patient Dashboard**.
2. **Continuous ISL Camera**:
   - Click **Start Camera** and grant browser permission.
   - Click **Start Signing** and demonstrate signs (e.g. `HELP`, `PAIN`, `CHEST_PAIN`, `DOCTOR`, `WATER`).
   - Click **Stop and Process**.
   - Review the recognized token chips. Click on any chip to edit words if needed.
   - If an unknown gesture is performed, notice the warning: *"Sign not recognized — please repeat or type your message."*
   - Click **Confirm Interpretation & Add to Report**.
3. **Interactive Anatomy Pain Map**:
   - Switch between **Front View** and **Back View**.
   - Click on an anatomical area (e.g. **Chest**, **Head**, or **Knee**).
   - In the modal dialog, select body side (Left/Right/Both), set the 0–10 intensity slider, choose pain type (e.g., Aching, Sharp), onset duration, and notes.
   - Click **Save Pain Details**. Notice the severity badge and summary card appear.
4. **Prepare & Send Report**:
   - Scroll down and click **Review & Send Report to Doctor**.
   - Inspect the structured report containing Patient Profile, Confirmed ISL Statements, Anatomy Pain Table, and Questions for Doctor.
   - Check **Patient Confirmation**.
   - Click **Save Offline in DB** (saves to IndexedDB) or click **Send to Doctor**.

### Doctor Workflow:
1. In the sidebar, click **Doctor Dashboard**.
2. Notice the incoming patient report appears in the left sidebar list.
3. Click on the patient report to open the full 12-section consultation view:
   - **Section 1**: Patient Communication Profile (accessibility needs, language, interpreter flag).
   - **Section 2 & 3**: Confirmed ISL Statements & Token Audit Trail (distinguishing AI predictions from patient edits).
   - **Section 4 & 5**: Visual Anatomy Pain Map & Characteristics Table.
   - **Section 6 & 7**: Speech-to-Text Clinician Response (speak or type a message, listen to audio).
   - **Section 8, 9, 10**: Accommodations, Checklist & Patient Questions.
   - **Section 11**: AI / Deterministic Clinical Summary (clearly labeled as informational, not a diagnosis).
   - **Section 12**: Clinician Consultation Notes Editor (type notes and click **Save Clinician Notes**).
4. Click **Mark Reviewed** on individual sections.
5. Click **Mark Consultation Completed** to finalize the clinical session.
6. Click **Print / Export Consultation** to generate a clean, print-formatted medical record.

---

## 5. Offline & Synchronization Architecture

- **Air-Gapped Operation**: Once cached, the application shell, SVG diagrams, and styles load completely offline without any active network connection.
- **Transfer Mode A (Same-Device Demo)**: Stores records in browser IndexedDB. Perfect for single-computer clinical demonstrations where patient and doctor use the same terminal.
- **Transfer Mode B (Shared Local Hospital LAN)**: Patient and doctor devices connect to the local hospital Flask server. Submissions require explicit patient confirmation and are validated server-side, returning a genuine `GENUINE_HOSPITAL_SERVER_ACKNOWLEDGED` receipt.
- **Sync Queue**: If the hospital server is temporarily unreachable, records are preserved in IndexedDB and queued in the `sync_queue` store with retry capabilities.
- **Backup & Export**: Use **Export JSON Backup** or **Import Backup JSON** in the *Offline Storage & Sync* panel to transfer records via air-gapped USB drives.

---

## 6. Dataset Integration and Model Training

The backend includes a dedicated dataset validation and preparation script:

```powershell
python isl-backend/prepare_isl_dataset.py --auto-create-folders
```

### Supported Dataset Sources:
1. **RealSign ISL Dataset**:
   - Open-source fingerspelled A-Z alphabet images.
   - Source: `https://github.com/RealSign62/RealSign-Indian-Sign-Language-Dataset`.
   - Place extracted folders in `isl-backend/dataset/Training/`, `Validation/`, `Testing/`.
   - Train with: `python isl-backend/train_model.py`.
2. **Continuous / Isolated Word Videos (INCLUDE & 40-Words ISL)**:
   - Source: AI4Bharat INCLUDE dataset and Hugging Face `Angirekula/isl-isolated-40words`.
   - Target vocabulary: `HELP`, `PAIN`, `CHEST_PAIN`, `DOCTOR`, `NURSE`, `WATER`, `MEDICINE`, `FEVER`, `BREATHING_DIFFICULTY`, `YES`, `NO`, `THANK_YOU`.
   - Place MP4 clips in `isl-backend/dataset/words/<LABEL>/` or record clips using:
     ```powershell
     python isl-backend/collect_word_clips.py --label HELP --count 30
     ```
   - Train continuous sequence model:
     ```powershell
     python isl-backend/train_continuous_model.py
     ```
   - Evaluation metrics (accuracy, precision, recall, F1, confusion matrix) are automatically saved to `isl-backend/models/continuous_evaluation.json`.

---

## 7. Medical Safety & Clinical Disclaimers

> **IMPORTANT MEDICAL NOTICE**:
> 1. SignCare AI is an accessible communication aid designed to facilitate dialogue between Deaf/hard-of-hearing patients and healthcare providers. It is **not** a diagnostic device, clinical decision support software, or automated triage system.
> 2. Pain location and intensity ratings do not establish a diagnosis; full physical examination and medical assessment by a qualified physician are mandatory.
> 3. Machine sign interpretations are candidate suggestions and must always be confirmed by the patient prior to transmission or clinical reliance.
> 4. In case of acute chest pain, severe dyspnea (shortness of breath), sudden neurological deficit, or severe trauma, activate emergency services (call 112 / 108) immediately.
