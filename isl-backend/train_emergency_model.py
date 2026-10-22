"""Train a dynamic emergency-word classifier from labelled ISL video clips.

Expected layout: dataset/words/HELP/*.mp4, PAIN/*.mp4, STOP/*.mp4, YES/*.mp4, NO/*.mp4
Every clip must show one clearly labelled sign. Use verified ISL examples only.
"""
from pathlib import Path
import json
import cv2
import mediapipe as mp
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'dataset' / 'words'
MODEL_DIR = ROOT / 'models'
FRAMES = 20
WORDS = ['HELP', 'PAIN', 'STOP', 'YES', 'NO']


def clip_features(path: Path) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened(): return None
    frames=[]
    with mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=2,
            model_complexity=0, min_detection_confidence=0.45,
            min_tracking_confidence=0.45) as hands:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0: total = FRAMES
        indices = np.linspace(0, max(0,total-1), FRAMES).astype(int)
        idx=0; target=0; current=None
        while target < len(indices):
            ok, frame = cap.read()
            if not ok: break
            if idx == indices[target]:
                rgb=cv2.cvtColor(cv2.resize(frame,(320,240)),cv2.COLOR_BGR2RGB)
                result=hands.process(rgb)
                values=[]
                if result.multi_hand_landmarks:
                    found=[]
                    for hand in result.multi_hand_landmarks:
                        arr=np.array([[p.x,p.y,p.z] for p in hand.landmark],dtype=np.float32)
                        # Normalize to wrist origin and palm scale.
                        arr -= arr[0]
                        scale=float(np.linalg.norm(arr[9]))
                        if scale>1e-5: arr/=scale
                        found.append(arr.flatten())
                    values=found[:2]
                while len(values)<2: values.append(np.zeros(63,dtype=np.float32))
                frames.append(np.concatenate(values[:2]))
                target+=1
            idx+=1
    cap.release()
    if not frames: return None
    while len(frames)<FRAMES: frames.append(frames[-1].copy())
    return np.stack(frames[:FRAMES]).flatten()


def main():
    X=[]; y=[]; counts={}
    if not DATA.exists(): raise SystemExit(f'Missing {DATA}. Read isl-backend/README.md for dataset setup.')
    for label in WORDS:
        folder=DATA/label
        clips=[] if not folder.exists() else [p for p in folder.rglob('*') if p.suffix.lower() in {'.mp4','.avi','.mov','.mkv'}]
        counts[label]=len(clips)
        for clip in clips:
            features=clip_features(clip)
            if features is not None: X.append(features); y.append(label)
    present=sorted(set(y))
    if len(present)<2: raise SystemExit(f'Need at least 2 labelled classes with readable clips. Found {counts}.')
    per_class={c:y.count(c) for c in present}
    if min(per_class.values())<5: raise SystemExit(f'Need at least 5 clips per class (prefer 30+ from several signers). Found {per_class}.')
    X=np.asarray(X,dtype=np.float32); y=np.asarray(y)
    X_train,X_test,y_train,y_test=train_test_split(X,y,test_size=0.2,random_state=42,stratify=y)
    clf=RandomForestClassifier(n_estimators=350,class_weight='balanced',random_state=42,n_jobs=-1,min_samples_leaf=2)
    clf.fit(X_train,y_train)
    pred=clf.predict(X_test); acc=float(accuracy_score(y_test,pred))
    MODEL_DIR.mkdir(parents=True,exist_ok=True)
    joblib.dump(clf,MODEL_DIR/'isl_emergency_words.joblib')
    (MODEL_DIR/'emergency_labels.json').write_text(json.dumps(list(clf.classes_),indent=2),encoding='utf-8')
    report={'task':'dynamic isolated ISL emergency/response signs','classes':list(clf.classes_),'clips_loaded':len(y),'clips_per_class':per_class,'held_out_clip_accuracy':acc,'classification_report':classification_report(y_test,pred,output_dict=True,zero_division=0),'warning':'Small or signer-overlapping datasets can inflate results. Not clinically validated; confirm all predictions.'}
    (MODEL_DIR/'emergency_evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    print('Saved:',MODEL_DIR/'isl_emergency_words.joblib')

if __name__=='__main__': main()
