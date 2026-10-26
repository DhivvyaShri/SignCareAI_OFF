"""Fetch public dataset metadata/card for inspection; does not bulk-download videos."""
from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "dataset" / "sources"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="vidit031/isl-isolated-40words", help="Hugging Face dataset repository ID")
    args = parser.parse_args()
    destination = SOURCES / args.repo.replace("/", "__")
    destination.mkdir(parents=True, exist_ok=True)
    api_url = f"https://huggingface.co/api/datasets/{urllib.parse.quote(args.repo, safe='/')}"
    try:
        with urllib.request.urlopen(api_url, timeout=20) as response:
            info = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise SystemExit(f"Could not reach Hugging Face to fetch metadata: {exc}. Check internet access and retry.") from exc
    files = [{"path": item["rfilename"], "size": item.get("size")} for item in info.get("siblings", [])]
    downloaded = []
    for item in files:
        name = item["path"]
        if name.lower().endswith((".csv", ".parquet", ".json", ".md", ".txt")):
            local = (destination / name).resolve()
            if not local.is_relative_to(destination.resolve()):
                raise ValueError(f"Unsafe dataset path: {name}")
            local.parent.mkdir(parents=True, exist_ok=True)
            url = f"https://huggingface.co/datasets/{urllib.parse.quote(args.repo, safe='/')}/resolve/{info.get('sha', 'main')}/{urllib.parse.quote(name, safe='/')}?download=true"
            with urllib.request.urlopen(url, timeout=45) as response, local.open("wb") as output:
                output.write(response.read(50 * 1024 * 1024 + 1))
            if local.stat().st_size > 50 * 1024 * 1024:
                local.unlink(missing_ok=True)
                raise ValueError(f"Metadata file exceeds 50 MB safety limit: {name}")
            downloaded.append({"path": name, "local_path": str(local.relative_to(ROOT / "dataset"))})
    inventory = {
        "repository": args.repo,
        "revision": info.get("sha"),
        "dataset_card_license_metadata": info.get("cardData"),
        "repository_files": files,
        "downloaded_metadata_files": downloaded,
        "video_files_in_repository": [item["path"] for item in files if item["path"].lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm"))],
        "note": "Metadata/card files only were fetched. Source-linked video assets are not bulk-downloaded; review per-source license and terms before obtaining them.",
    }
    (destination / "source_inventory.json").write_text(json.dumps(inventory, indent=2, default=str), encoding="utf-8")
    print(json.dumps(inventory, indent=2, default=str))


if __name__ == "__main__":
    main()
