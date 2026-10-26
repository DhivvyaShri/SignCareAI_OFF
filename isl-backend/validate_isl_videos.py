
from pathlib import Path
import csv
import cv2
from collections import Counter

root = Path("dataset/raw/isl-isolated-40words")
report_path = root / "video_validation_report.csv"

videos = sorted(root.rglob("*.mp4"))
label_counts = Counter()
results = []

for i, path in enumerate(videos, start=1):
    label = path.parent.name
    label_counts[label] += 1

    cap = cv2.VideoCapture(str(path))
    opened = cap.isOpened()

    if opened:
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        readable = frames > 0 and width > 0 and height > 0
        duration = frames / fps if fps > 0 else 0
    else:
        frames, fps, width, height = 0, 0, 0, 0
        readable, duration = False, 0

    cap.release()

    results.append({
        "path": str(path.relative_to(root)),
        "label": label,
        "opened": opened,
        "readable": readable,
        "frames": frames,
        "fps": round(fps, 2),
        "width": width,
        "height": height,
        "duration_seconds": round(duration, 2),
        "size_bytes": path.stat().st_size
    })

    if i % 50 == 0:
        print(f"Checked {i}/{len(videos)} videos")

fields = [
    "path", "label", "opened", "readable", "frames",
    "fps", "width", "height", "duration_seconds", "size_bytes"
]

with report_path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(results)

print("\n--- VALIDATION SUMMARY ---")
print("Total videos:", len(videos))
print("Readable videos:", sum(r["readable"] for r in results))
print("Unreadable videos:", sum(not r["readable"] for r in results))
print("Labels:", len(label_counts))
print("\nVideos per label:")
for label, count in sorted(label_counts.items()):
    print(f"{label}: {count}")

print("\nReport saved to:", report_path.resolve())
