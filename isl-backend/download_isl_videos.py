from pathlib import Path
from huggingface_hub import hf_hub_download, list_repo_files
import shutil

repo = "vidit031/isl-isolated-40words"
output = Path("dataset/raw/isl-isolated-40words")
output.mkdir(parents=True, exist_ok=True)

files = [
    f for f in list_repo_files(repo, repo_type="dataset")
    if f.lower().endswith(".mp4")
]

print(f"Found {len(files)} remote videos.")

for i, name in enumerate(files, 1):
    target = output / name
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists() and target.stat().st_size > 0:
        print(f"[{i}/{len(files)}] Already exists: {name}")
        continue

    try:
        cached = hf_hub_download(
            repo_id=repo,
            repo_type="dataset",
            filename=name
        )
        shutil.copy2(cached, target)
        print(f"[{i}/{len(files)}] Downloaded: {name}")
    except Exception as e:
        print(f"[{i}/{len(files)}] FAILED: {name} | {e}")

print("Download process finished.")
print("Output:", output.resolve())
print("Local MP4 count:", sum(1 for _ in output.rglob("*.mp4")))
