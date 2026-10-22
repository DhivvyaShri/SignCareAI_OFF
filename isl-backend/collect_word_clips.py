"""Collect short, labelled webcam clips for the experimental ISL word model.
Use only signs demonstrated/verified by a qualified ISL signer or interpreter.
"""
from pathlib import Path
import argparse
import time
import cv2

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--label', required=True, choices=['HELP','PAIN','STOP','YES','NO'])
parser.add_argument('--count', type=int, default=30, help='Number of clips to record')
parser.add_argument('--seconds', type=float, default=2.0, help='Duration of each clip')
parser.add_argument('--camera', type=int, default=0)
args = parser.parse_args()

out_dir = ROOT / 'dataset' / 'words' / args.label
out_dir.mkdir(parents=True, exist_ok=True)
cap = cv2.VideoCapture(args.camera)
if not cap.isOpened(): raise SystemExit('Could not open camera. Check camera permissions/device index.')
print(f'Collecting {args.count} clips for {args.label}. Press SPACE to record each clip; ESC to quit.')
try:
    for n in range(args.count):
        while True:
            ok, frame = cap.read()
            if not ok: raise SystemExit('Camera frame could not be read.')
            cv2.putText(frame, f'LABEL: {args.label} | Clip {n+1}/{args.count}', (12,30), cv2.FONT_HERSHEY_SIMPLEX, .7, (30,220,80), 2)
            cv2.putText(frame, 'SPACE = record | ESC = quit', (12,60), cv2.FONT_HERSHEY_SIMPLEX, .6, (255,255,255), 2)
            cv2.imshow('SignBridge ISL data collector', frame)
            key=cv2.waitKey(1)&0xFF
            if key==27: raise SystemExit('Collection cancelled.')
            if key==32: break
        filename=out_dir/f'{args.label.lower()}_{int(time.time()*1000)}_{n+1:03d}.mp4'
        h,w=frame.shape[:2]
        writer=cv2.VideoWriter(str(filename),cv2.VideoWriter_fourcc(*'mp4v'),20,(w,h))
        start=time.time()
        while time.time()-start < args.seconds:
            ok, frame=cap.read()
            if not ok: break
            writer.write(frame)
            cv2.putText(frame, f'RECORDING {args.label}', (12,32), cv2.FONT_HERSHEY_SIMPLEX, .8, (0,0,255), 2)
            cv2.imshow('SignBridge ISL data collector',frame)
            if cv2.waitKey(1)&0xFF==27: break
        writer.release()
        print('Saved',filename)
finally:
    cap.release(); cv2.destroyAllWindows()
print('Collection complete. Review clips and labels before training.')
