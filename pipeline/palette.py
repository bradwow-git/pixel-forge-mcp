#!/usr/bin/env python3
"""
Apply a named palette to a sprite PNG.

Observed MVP heuristic:
- Transparent pixels stay transparent.
- Visible pixels are remapped to the nearest configured palette color.
- Semi-transparent pixels keep alpha while adopting the nearest palette RGB.

Future palette heuristics should be documented here before behavior changes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def nearest_color(rgb: tuple[int, int, int], palette: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    return min(
        palette,
        key=lambda color: (
            (rgb[0] - color[0]) ** 2
            + (rgb[1] - color[1]) ** 2
            + (rgb[2] - color[2]) ** 2
        ),
    )


def apply_palette(source_path: Path, output_path: Path, palette_colors: list[str]) -> None:
    if not source_path.exists():
        raise FileNotFoundError(f"Source image not found: {source_path}")

    palette = [hex_to_rgb(color) for color in palette_colors]

    with Image.open(source_path) as image:
        rgba = image.convert("RGBA")
        pixels = rgba.load()

        for y in range(rgba.height):
            for x in range(rgba.width):
                red, green, blue, alpha = pixels[x, y]
                if alpha == 0:
                    continue

                next_red, next_green, next_blue = nearest_color((red, green, blue), palette)
                pixels[x, y] = (next_red, next_green, next_blue, alpha)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        rgba.save(output_path, format="PNG")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply a configured palette to a PNG sprite.")
    parser.add_argument("--input", required=True, help="Source image path")
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument("--palette-name", required=True, help="Palette label for logs")
    parser.add_argument("--palette-colors", required=True, help="JSON array of hex color strings")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    palette_colors = json.loads(args.palette_colors)
    if not isinstance(palette_colors, list) or not palette_colors:
        raise ValueError("Palette colors must be a non-empty JSON array.")

    apply_palette(Path(args.input), Path(args.output), palette_colors)
    print(f"{args.palette_name}:{args.output}")


if __name__ == "__main__":
    main()
