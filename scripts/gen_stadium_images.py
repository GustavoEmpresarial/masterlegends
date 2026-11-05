#!/usr/bin/env python3
"""Pixel-art stadium backgrounds for the five catalog venues."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

W, H = 320, 200
OUT_W, OUT_H = 1280, 800


def up(img: Image.Image) -> Image.Image:
    return img.resize((OUT_W, OUT_H), Image.NEAREST)


def rect(draw: ImageDraw.ImageDraw, box, color):
    draw.rectangle(box, fill=color)


def dither_fill(px, x0, y0, x1, y1, a, b, step=2):
    for y in range(y0, y1):
        for x in range(x0, x1):
            px[x, y] = a if (x + y) % step == 0 else b


def pitch(px, y0, y1, dark, light, line):
    dark, light, line = hex_rgb(dark), hex_rgb(light), hex_rgb(line)
    for y in range(y0, y1):
        stripe = (y - y0) // 8
        c = dark if stripe % 2 == 0 else light
        for x in range(0, W):
            px[x, y] = c
    # touch lines
    for x in range(18, W - 18):
        px[x, y0 + 2] = line
        px[x, y1 - 3] = line
    for y in range(y0 + 2, y1 - 2):
        px[18, y] = line
        px[W - 19, y] = line
    mid = (y0 + y1) // 2
    for x in range(18, W - 18):
        px[x, mid] = line
    cx, cy = W // 2, mid
    for y in range(cy - 14, cy + 15):
        for x in range(cx - 22, cx + 23):
            d = ((x - cx) / 22) ** 2 + ((y - cy) / 14) ** 2
            if 0.86 < d < 1.08:
                px[x, y] = line
    # boxes
    for box_y, h in ((y0 + 3, 22), (y1 - 25, 22)):
        for x in range(cx - 40, cx + 41):
            px[x, box_y] = line
            px[x, box_y + h] = line
        for y in range(box_y, box_y + h + 1):
            px[cx - 40, y] = line
            px[cx + 40, y] = line


def hex_rgb(c):
    if isinstance(c, tuple):
        return c
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))


def stand_row(px, y, x0, x1, colors):
    rgb = [hex_rgb(c) for c in colors]
    for x in range(x0, x1):
        px[x, y] = rgb[(x // 3 + y) % len(rgb)]


def flood_lights(draw, color):
    for x in (36, 88, 230, 282):
        draw.polygon([(x, 28), (x + 8, 28), (x + 4, 8)], fill="#1a1a1a")
        draw.ellipse((x - 10, 24, x + 18, 36), fill=color)


def save(img: Image.Image, *rel: str):
    out = up(img)
    for r in rel:
        path = Path(r)
        path.parent.mkdir(parents=True, exist_ok=True)
        out.save(path, "PNG")
        print("wrote", path)


def arena_vila() -> Image.Image:
    img = Image.new("RGB", (W, H), "#87b8e0")
    px = img.load()
    draw = ImageDraw.Draw(img)
    for y in range(0, 70):
        t = y / 70
        c = (int(135 + 40 * t), int(184 - 20 * t), int(224 - 40 * t))
        for x in range(W):
            px[x, y] = c
    # houses
    for i, x in enumerate((8, 40, 72, 230, 262, 292)):
        h = 18 + (i % 3) * 6
        roof = "#8b3a2a" if i % 2 == 0 else "#5c3d2e"
        wall = "#d9c3a0" if i % 2 == 0 else "#c4b08a"
        rect(draw, (x, 70 - h, x + 22, 70), wall)
        draw.polygon([(x - 2, 70 - h), (x + 11, 70 - h - 8), (x + 24, 70 - h)], fill=roof)
    rect(draw, (0, 70, W, 86), "#4a7c3a")
    # stands
    for i, y in enumerate(range(78, 96)):
        stand_row(px, y, 6, W - 6, ["#8b4513", "#a0522d", "#6b3a14", "#c4a574"][i % 2 :: 2] or ["#8b4513", "#c4a574"])
    for y in range(78, 96):
        stand_row(px, y, 10, W - 10, ("#7a3e12", "#c9a227", "#5c2e0e", "#e8d5a3"))
    pitch(px, 96, 188, "#2f7a32", "#3a8f38", "#e8f5e9")
    # flood late-afternoon
    rect(draw, (0, 188, W, H), "#3d2a18")
    return img


def estadio_luzes() -> Image.Image:
    img = Image.new("RGB", (W, H), "#071018")
    px = img.load()
    draw = ImageDraw.Draw(img)
    for y in range(0, 64):
        for x in range(W):
            px[x, y] = (6, 12 + y // 6, 28 + y // 5)
    # city glow
    for x in range(0, W, 3):
        if (x * 17) % 11 < 3:
            px[x, 50 + (x % 7)] = (40, 180, 220)
    flood_lights(draw, "#b8f3ff")
    for y in range(64, 92):
        stand_row(px, y, 4, W - 4, ("#12202c", "#1d3344", "#0b1620", "#2a4a5c"))
    # neon rim
    for x in range(8, W - 8):
        px[x, 64] = (0, 230, 255)
        px[x, 91] = (255, 40, 180)
    pitch(px, 92, 186, "#14532d", "#166534", "#a7f3d0")
    # light beams
    for x0 in (40, 92, 228, 280):
        for y in range(36, 92):
            for dx in range(-6, 7):
                xx = x0 + dx + (y - 36) // 8
                if 0 <= xx < W and (x0 + dx + y) % 3 == 0:
                    r, g, b = px[xx, y]
                    px[xx, y] = (min(255, r + 18), min(255, g + 22), min(255, b + 12))
    rect(draw, (0, 186, W, H), "#020617")
    return img


def fortaleza_azul() -> Image.Image:
    img = Image.new("RGB", (W, H), "#7ec8e3")
    px = img.load()
    draw = ImageDraw.Draw(img)
    for y in range(0, 58):
        for x in range(W):
            px[x, y] = (110 + y, 190 - y // 3, 230)
    # ocean
    for y in range(58, 78):
        for x in range(W):
            px[x, y] = (30, 90 + (x + y) % 20, 170) if (x + y) % 5 else (50, 130, 200)
    # cliffs
    rect(draw, (0, 70, 40, 92), "#c4b39a")
    rect(draw, (280, 66, W, 92), "#d2c2a6")
    for y in range(78, 100):
        stand_row(px, y, 8, W - 8, ("#1d4ed8", "#2563eb", "#1e3a8a", "#93c5fd"))
    pitch(px, 100, 188, "#15803d", "#22c55e", "#ecfccb")
    # corner flags
    px[20, 102] = (255, 255, 255)
    px[W - 21, 102] = (255, 255, 255)
    rect(draw, (0, 188, W, H), "#0c4a6e")
    return img


def coliseu_imperial() -> Image.Image:
    img = Image.new("RGB", (W, H), "#f3e2b8")
    px = img.load()
    draw = ImageDraw.Draw(img)
    for y in range(0, 56):
        for x in range(W):
            px[x, y] = (243 - y, 210 - y // 2, 150)
    # columns
    for x in (16, 48, 80, 232, 264, 296):
        rect(draw, (x, 28, x + 10, 78), "#e7d3a1")
        rect(draw, (x - 2, 24, x + 12, 30), "#d4af37")
        rect(draw, (x - 2, 74, x + 12, 80), "#c9a227")
    rect(draw, (0, 78, W, 86), "#b8860b")
    for y in range(86, 104):
        stand_row(px, y, 6, W - 6, ("#7c2d12", "#b45309", "#451a03", "#fbbf24"))
    pitch(px, 104, 188, "#365314", "#4d7c0f", "#fefce8")
    # gold arch
    for x in range(110, 210):
        px[x, 40] = (212, 175, 55)
        px[x, 41] = (255, 215, 80)
    rect(draw, (0, 188, W, H), "#3f2a14")
    return img


def arena_vulcao() -> Image.Image:
    img = Image.new("RGB", (W, H), "#1a0a08")
    px = img.load()
    draw = ImageDraw.Draw(img)
    for y in range(0, 60):
        for x in range(W):
            px[x, y] = (40 + y // 2, 10, 12)
    # volcano
    draw.polygon([(90, 70), (160, 18), (230, 70)], fill="#3f1d12")
    draw.polygon([(140, 28), (160, 14), (180, 28)], fill="#7f1d1d")
    for y in range(20, 40):
        for x in range(150, 172):
            if (x + y) % 2 == 0:
                px[x, y] = (255, 90 + (y % 20), 20)
    for y in range(70, 96):
        stand_row(px, y, 4, W - 4, ("#7f1d1d", "#450a0a", "#b91c1c", "#1c1917"))
    pitch(px, 96, 186, "#365314", "#3f6212", "#fde68a")
    # lava rim
    for x in range(0, W):
        px[x, 96] = (255, 80, 20) if x % 3 else (180, 30, 10)
    rect(draw, (0, 186, W, H), "#1c1917")
    return img


def main():
    root = Path(__file__).resolve().parents[1]
    web = root / "apps/web/public/ui/stadiums"
    api = root / "apps/api/uploads/stadiums"
    specs = [
        (arena_vila, "arena-vila.png", True),
        (estadio_luzes, "estadio-luzes.png", False),
        (fortaleza_azul, "fortaleza-azul.png", False),
        (coliseu_imperial, "coliseu-imperial.png", False),
        (arena_vulcao, "arena-vulcao.png", False),
    ]
    for fn, name, also_default in specs:
        img = fn()
        save(img, str(web / name), str(api / name))
        if also_default:
            save(img, str(web / "default.png"), str(api / "default.png"))


if __name__ == "__main__":
    main()
