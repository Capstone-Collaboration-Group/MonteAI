"""Extract ONLY the two fixed, non-personal artwork regions from a reference ID.

The entire rectified card stays in memory. No portrait, name, number or signature
is written. Inspect the resulting logo/seal files before using a new design.
"""

import argparse
from pathlib import Path

import cv2
import numpy as np

from verification.config import ROOT
from verification.images import crop, decode_image, warp_card

ARTWORK_BOXES = {
    "cdm-logo.png": [0.054, 0.005, 0.196, 0.088],
    "montalban-seal.png": [0.70, 0.805, 0.985, 0.988],
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--corners", required=True, help="x,y x,y x,y x,y, clockwise from top-left")
    parser.add_argument(
        "--replace", action="store_true", help="Replace previously generated artwork"
    )
    args = parser.parse_args()
    points = np.array([[float(n) for n in pair.split(",")] for pair in args.corners.split()])
    if points.shape != (4, 2):
        parser.error("Exactly four corners are required")
    raw = bytearray(args.source.read_bytes())
    image = card = None
    try:
        image = decode_image(raw)
        card = warp_card(image, points, 720, 1120)
        target = ROOT / "templates" / "assets"
        target.mkdir(parents=True, exist_ok=True)
        for name, box in ARTWORK_BOXES.items():
            path = target / name
            if path.exists() and not args.replace:
                raise SystemExit(f"Refusing to overwrite {name}; review/remove it explicitly first")
            if not cv2.imwrite(str(path), crop(card, box)):
                raise OSError("Could not save artwork")
            print(f"Extracted {name}")
    finally:
        raw[:] = b"\0" * len(raw)
        for owned in (image, card):
            if owned is not None:
                owned.fill(0)


if __name__ == "__main__":
    main()
