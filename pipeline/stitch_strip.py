#!/usr/bin/env python3
"""
Create a simple sprite animation strip from equally sized frames.

Observed MVP heuristic:
- Every source frame must already match the requested frame width and height.
- Frames are stitched in input order.
- Only horizontal and vertical strips are supported.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stitch multiple sprite frames into a horizontal or vertical strip."
    )
    parser.add_argument("--output", required=True, help="Output strip PNG path")
    parser.add_argument("--frame-width", required=True, type=int, help="Expected frame width")
    parser.add_argument("--frame-height", required=True, type=int, help="Expected frame height")
    parser.add_argument(
        "--direction",
        required=True,
        choices=("horizontal", "vertical"),
        help="Strip layout direction",
    )
    parser.add_argument("--frames", nargs="+", required=True, help="Ordered frame paths")
    return parser.parse_args()


def validate_frame(frame_path: Path, frame_width: int, frame_height: int) -> None:
    if not frame_path.exists():
        raise FileNotFoundError(f"Animation frame not found: {frame_path}")

    with Image.open(frame_path) as image:
        rgba = image.convert("RGBA")
        if rgba.width != frame_width or rgba.height != frame_height:
            raise ValueError(
                f"Frame size mismatch for {frame_path}. "
                f"Expected {frame_width}x{frame_height}, got {rgba.width}x{rgba.height}."
            )


def stitch_frames(
    frame_paths: list[Path],
    output_path: Path,
    frame_width: int,
    frame_height: int,
    direction: str,
) -> None:
    for frame_path in frame_paths:
        validate_frame(frame_path, frame_width, frame_height)

    if direction == "horizontal":
        strip_size = (frame_width * len(frame_paths), frame_height)
    else:
        strip_size = (frame_width, frame_height * len(frame_paths))

    strip = Image.new("RGBA", strip_size, (0, 0, 0, 0))

    for index, frame_path in enumerate(frame_paths):
        with Image.open(frame_path) as frame_image:
            frame = frame_image.convert("RGBA")
            if direction == "horizontal":
                position = (index * frame_width, 0)
            else:
                position = (0, index * frame_height)
            strip.paste(frame, position, frame)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(output_path, format="PNG")


def main() -> None:
    args = parse_args()
    frame_paths = [Path(frame_path) for frame_path in args.frames]
    stitch_frames(
        frame_paths=frame_paths,
        output_path=Path(args.output),
        frame_width=args.frame_width,
        frame_height=args.frame_height,
        direction=args.direction,
    )
    print(args.output)


if __name__ == "__main__":
    main()
