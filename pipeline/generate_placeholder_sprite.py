from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a simple placeholder sprite source image for Pixel Forge."
    )
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument("--prompt", required=True, help="Prompt text used for deterministic variation")
    parser.add_argument("--id", required=True, help="Sprite id")
    parser.add_argument("--name", required=True, help="Sprite display name")
    parser.add_argument("--size", required=True, type=int, help="Target sprite size")
    parser.add_argument(
        "--palette-colors",
        required=True,
        help="JSON array of palette colors in #RRGGBB format",
    )
    return parser.parse_args()


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def main() -> None:
    args = parse_args()
    colors = json.loads(args.palette_colors)
    if not isinstance(colors, list) or len(colors) < 3:
        raise ValueError("palette-colors must contain at least three colors")

    palette = [hex_to_rgb(str(color)) for color in colors]
    width = max(args.size * 4, 64)
    height = width

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGBA", (width, height), palette[0] + (0,))
    draw = ImageDraw.Draw(image)

    seed_source = f"{args.id}|{args.name}|{args.prompt}|{args.size}"
    digest = hashlib.sha256(seed_source.encode("utf8")).digest()

    body_color = palette[min(2, len(palette) - 1)]
    outline_color = palette[1]
    accent_color = palette[min(3, len(palette) - 1)]
    eye_color = palette[-1]

    center_x = width // 2
    center_y = height // 2 + int(digest[0] % max(2, width // 16)) - max(1, width // 32)
    body_width = width // 2 + int(digest[1] % max(4, width // 10)) - max(2, width // 20)
    body_height = height // 3 + int(digest[2] % max(4, height // 12)) - max(2, height // 24)
    left = clamp(center_x - body_width // 2, width // 10, width - width // 10)
    top = clamp(center_y - body_height // 2, height // 8, height - height // 5)
    right = clamp(center_x + body_width // 2, width // 5, width - width // 10)
    bottom = clamp(center_y + body_height // 2, height // 4, height - height // 8)

    draw.ellipse((left, top, right, bottom), fill=body_color + (255,), outline=outline_color + (255,), width=max(2, width // 32))

    glow_radius = max(2, width // 20)
    for offset in range(3):
        glow_alpha = max(30, 90 - offset * 20)
        draw.ellipse(
            (
                left + glow_radius - offset * 2,
                top + glow_radius - offset * 2,
                right - glow_radius + offset * 2,
                bottom - glow_radius + offset * 2,
            ),
            outline=accent_color + (glow_alpha,),
            width=1,
        )

    eye_y = top + body_height // 3
    eye_offset = max(4, width // 10)
    eye_radius = max(2, width // 18)
    for direction in (-1, 1):
        eye_x = center_x + direction * eye_offset
        draw.ellipse(
            (
                eye_x - eye_radius,
                eye_y - eye_radius,
                eye_x + eye_radius,
                eye_y + eye_radius,
            ),
            fill=eye_color + (255,),
        )

    mouth_width = max(6, width // 8)
    mouth_y = center_y + body_height // 5
    draw.arc(
        (
            center_x - mouth_width // 2,
            mouth_y - eye_radius,
            center_x + mouth_width // 2,
            mouth_y + eye_radius,
        ),
        start=0,
        end=180,
        fill=outline_color + (255,),
        width=max(1, width // 40),
    )

    for index in range(14):
        noise_size = max(2, width // 24) + (digest[index % len(digest)] % max(2, width // 40))
        noise_x = digest[(index * 3) % len(digest)] % max(1, width - noise_size)
        noise_y = digest[(index * 5 + 1) % len(digest)] % max(1, height - noise_size)
        noise_color = accent_color if index % 2 == 0 else outline_color
        noise_alpha = 45 + (digest[(index * 7 + 2) % len(digest)] % 70)
        draw.rounded_rectangle(
            (
                noise_x,
                noise_y,
                noise_x + noise_size,
                noise_y + noise_size,
            ),
            radius=max(1, noise_size // 3),
            fill=noise_color + (noise_alpha,),
        )

    image.save(output_path)


if __name__ == "__main__":
    main()
