#!/usr/bin/env python3
"""
Pixelize a source image into a square RGBA sprite.

Observed MVP heuristic:
- Keep transparency.
- Preserve aspect ratio with transparent padding.
- Resize to the requested sprite size.

Future parser or decode-specific heuristics should be documented near the
relevant processing logic before behavior changes.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def pixelize_image(source_path: Path, output_path: Path, size: int) -> None:
    if not source_path.exists():
        raise FileNotFoundError(f"Source image not found: {source_path}")

    with Image.open(source_path) as image:
        rgba = image.convert("RGBA")
        contained = rgba.copy()
        contained.thumbnail((size, size), Image.Resampling.LANCZOS)

        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        offset_x = (size - contained.width) // 2
        offset_y = (size - contained.height) // 2
        canvas.paste(contained, (offset_x, offset_y), contained)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output_path, format="PNG")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pixelize a source image into a sprite-sized PNG.")
    parser.add_argument("--input", required=True, help="Source image path")
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument("--size", required=True, type=int, help="Final sprite width and height")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pixelize_image(Path(args.input), Path(args.output), args.size)
    print(args.output)


if __name__ == "__main__":
    main()
