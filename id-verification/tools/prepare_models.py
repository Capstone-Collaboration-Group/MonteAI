"""Download pinned PUBLIC model weights at build time; never run on submitted IDs."""

import argparse
import hashlib
import json
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]


def prepare(check_only: bool = False) -> None:
    model_dir = ROOT / "models"
    manifest = json.loads((model_dir / "manifest.json").read_text())
    for entry in manifest["files"]:
        target = model_dir / entry["name"]
        valid = False
        if target.is_file():
            with target.open("rb") as model:
                valid = hashlib.file_digest(model, "sha256").hexdigest() == entry["sha256"]
        if valid:
            print(f"Verified {entry['name']}")
            continue
        if check_only:
            raise SystemExit(f"Missing or invalid model: {entry['name']}")
        temporary = target.with_suffix(".partial")
        try:
            digest = hashlib.sha256()
            size = 0
            with requests.get(entry["url"], stream=True, timeout=(10, 60)) as response:
                response.raise_for_status()
                with temporary.open("wb") as output:
                    for chunk in response.iter_content(1024 * 1024):
                        size += len(chunk)
                        if size > 100 * 1024 * 1024:
                            raise ValueError("Model exceeds expected size")
                        digest.update(chunk)
                        output.write(chunk)
            if digest.hexdigest() != entry["sha256"]:
                raise ValueError("Model checksum mismatch")
            temporary.replace(target)
            print(f"Prepared {entry['name']} ({size / 1024 / 1024:.1f} MiB)")
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    prepare(parser.parse_args().check)
