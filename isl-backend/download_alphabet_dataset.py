"""Download and extract the public RealSign ISL A-Z image dataset.
Run from isl-backend with internet access: python download_alphabet_dataset.py
"""
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
import io, sys

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "dataset"
URLS = [
    "https://github.com/RealSign62/RealSign-Indian-Sign-Language-Dataset/raw/refs/heads/main/Dataset.zip",
    "https://github.com/RealSign62/RealSign-Indian-Sign-Language-Dataset/raw/main/Dataset.zip",
]

if all((DATA / name).is_dir() for name in ("Training", "Validation", "Testing")):
    print(f"Dataset already appears extracted at: {DATA}")
    raise SystemExit(0)

last_error = None
for url in URLS:
    try:
        print(f"Downloading dataset from {url}\nThis may take a few minutes...")
        request = Request(url, headers={"User-Agent": "SignBridge-ISL-training/1.0"})
        with urlopen(request, timeout=60) as response:
            payload = response.read()
        with ZipFile(io.BytesIO(payload)) as archive:
            names = archive.namelist()
            if not any("Training/" in n or "Training\\" in n for n in names):
                raise ValueError("Downloaded ZIP did not contain the expected Training folder.")
            archive.extractall(DATA)
        print(f"Dataset extracted to {DATA}")
        print("Next: python train_model.py")
        break
    except Exception as exc:
        last_error = exc
else:
    print("Dataset download failed. Check internet access and download Dataset.zip manually from:")
    print("https://github.com/RealSign62/RealSign-Indian-Sign-Language-Dataset")
    print(f"Error: {last_error}")
    sys.exit(1)
