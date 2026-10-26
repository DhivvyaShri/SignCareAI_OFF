# Implementation and verification status

| Feature | Status | Evidence / limitation |
|---|---|---|
| Patient/doctor React app and existing navigation | implemented_but_not_verified | Existing routes and screens retained; production build is run as part of this update. |
| Interactive front/back pain map | implemented_but_not_verified | Existing implementation retained. |
| Local IndexedDB reports and offline shell | implemented_but_not_verified | Existing implementation retained; browser offline testing has not been run. |
| Dataset inspection and readiness report | implemented_but_not_verified | Metadata inventory downloader and video validator added; no dataset videos are present locally. |
| Genuine isolated-sign production model | blocked | No real clips; model readiness is false. Calibration model is isolated under `models/calibration/` and rejected. |
| MediaPipe landmarks shared by training and inference | implemented_but_not_verified | Replaces contour sampling; requires MediaPipe runtime and data to validate. |
| Secure clinician report reads/review | partially_implemented | Backend requires configured bearer secret for reads/review; frontend LAN token field exists. Deployment still needs HTTPS/network controls and operational identity management. |
| AI mode reporting and errors | implemented_but_not_verified | Local template and service responses identify engine; hosted AI requires consent and returns errors without fallback. NVIDIA key not available. |
| UI palette refresh | implemented_but_not_verified | Midnight navy, indigo, blue, teal, lavender and focus treatments applied. Visual/browser QA not run. |
| Genuine model evaluation | not_evaluated | No authentic dataset clips; old calibration metrics are invalid and must not be quoted. |

The stored `models/calibration/continuous_evaluation.json` score of 1.0 is from synthetic calibration data. It is not recognition accuracy and is explicitly excluded from production status.
