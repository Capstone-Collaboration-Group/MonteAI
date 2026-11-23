"""Write the staged whitelist as a Linux-compatible source ZIP."""

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def create_archive(stage: Path, output: Path) -> None:
    if not stage.is_dir():
        raise ValueError("Package staging directory does not exist.")

    files = sorted(path for path in stage.rglob("*") if path.is_file())
    # Exclusive creation protects existing releases, including a concurrent writer.
    with ZipFile(output, "x", ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(stage).as_posix())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    create_archive(args.stage, args.output)
