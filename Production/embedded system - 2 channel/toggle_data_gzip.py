#!/usr/bin/env python3
"""
Toggle gzip-compressed assets in the data folder.

Usage:
  python3 toggle_data_gzip.py compress
  python3 toggle_data_gzip.py decompress

Optional:
  python3 toggle_data_gzip.py compress --dir code/main/data --dry-run
"""

from __future__ import annotations

import argparse
import gzip
from pathlib import Path


COMPRESSIBLE_EXTENSIONS = {
    ".css",
    ".js",
    ".json",
    ".csv",
    ".svg",
    ".xml",
    ".map",
}

SKIP_FILENAMES = {
    "index.html",
}


def is_compressible(path: Path) -> bool:
    # Do not gzip files that are already compressed formats.
    if path.suffix.lower() == ".gz":
        return False
    if path.name in SKIP_FILENAMES:
        return False
    return path.suffix.lower() in COMPRESSIBLE_EXTENSIONS


def compress_file(src: Path, dry_run: bool) -> bool:
    dst = src.with_name(src.name + ".gz")
    print(f"[compress] {src} -> {dst}")
    if dry_run:
        return True

    with src.open("rb") as f_in, gzip.open(dst, "wb", compresslevel=9) as f_out:
        f_out.write(f_in.read())

    src.unlink()
    return True


def decompress_file(src_gz: Path, dry_run: bool) -> bool:
    if src_gz.suffix.lower() != ".gz":
        return False

    dst = src_gz.with_suffix("")
    print(f"[decompress] {src_gz} -> {dst}")
    if dry_run:
        return True

    with gzip.open(src_gz, "rb") as f_in, dst.open("wb") as f_out:
        f_out.write(f_in.read())

    src_gz.unlink()
    return True


def run_compress(root: Path, dry_run: bool) -> tuple[int, int]:
    changed = 0
    skipped = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() == ".gz":
            skipped += 1
            continue
        if not is_compressible(path):
            skipped += 1
            continue
        if compress_file(path, dry_run):
            changed += 1
    return changed, skipped


def run_decompress(root: Path, dry_run: bool) -> tuple[int, int]:
    changed = 0
    skipped = 0
    for path in root.rglob("*.gz"):
        if not path.is_file():
            skipped += 1
            continue
        if decompress_file(path, dry_run):
            changed += 1
        else:
            skipped += 1
    return changed, skipped


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compress or decompress data assets using gzip.")
    parser.add_argument(
        "mode",
        choices=["compress", "decompress"],
        help="Mode: compress assets to .gz and delete originals, or decompress .gz and delete .gz files.",
    )
    parser.add_argument(
        "--dir",
        default="code/main/data",
        help="Target directory to process. Default: code/main/data",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show actions without writing or deleting files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.dir).resolve()

    if not root.exists() or not root.is_dir():
        print(f"[error] Directory does not exist: {root}")
        return 1

    print(f"[info] mode={args.mode} dir={root} dry_run={args.dry_run}")

    if args.mode == "compress":
        changed, skipped = run_compress(root, args.dry_run)
    else:
        changed, skipped = run_decompress(root, args.dry_run)

    print(f"[done] changed={changed} skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
