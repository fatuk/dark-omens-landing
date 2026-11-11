"""Скриншоты игры → картинки галереи лендинга.

Исходники — images/raw/*.png (снимки окна игры). Срезаем серую рамку окна
(у каждого снимка своя толщина), центр-кропим ровно в 16:9 и пишем webp в двух
размерах: images/<name>-1600.webp и images/<name>-800.webp — их берёт srcset.

    python tools/build-gallery.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "images" / "raw"
OUT = ROOT / "images"

# исходник → имя на сайте (порядок здесь = порядок в галерее, для справки)
SHOTS = {
    "map.png": "map",
    "investigator-picker.png": "investigators",
    "map-location.png": "location",
    "myth.png": "mythos",
    "telegram.png": "encounter",
    "condition-check.png": "condition",
    "spell.png": "spell",
    "shop.png": "shop",
    "game-hint.png": "guide",
    "pause-menu.png": "pause",
}
WIDTHS = (1600, 800)
QUALITY = 82
SAFETY = 3  # ещё пара пикселей сверх найденной рамки — на антиалиасинг края


def _is_frame(px: tuple) -> bool:
    """Пиксель серой рамки окна (≈41–43, почти без оттенка)."""
    return all(36 <= c <= 48 for c in px[:3]) and max(px[:3]) - min(px[:3]) <= 3


def _frame_depth(im: Image.Image, side: str) -> int:
    w, h = im.size
    n = 0
    while n < 60:
        if side == "t":
            line = [im.getpixel((x, n)) for x in range(0, w, 5)]
        elif side == "b":
            line = [im.getpixel((x, h - 1 - n)) for x in range(0, w, 5)]
        elif side == "l":
            line = [im.getpixel((n, y)) for y in range(0, h, 5)]
        else:
            line = [im.getpixel((w - 1 - n, y)) for y in range(0, h, 5)]
        if sum(1 for p in line if _is_frame(p)) / len(line) < 0.9:
            break
        n += 1
    return n


def _prepare(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    t, b, l, r = (_frame_depth(im, s) + SAFETY for s in "tblr")
    im = im.crop((l, t, im.width - r, im.height - b))
    # центр-кроп в 16:9 — галерея и так режет object-fit: cover, пусть режем мы
    w, h = im.size
    if w * 9 > h * 16:
        nw = h * 16 // 9
        x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:
        nh = w * 9 // 16
        y = (h - nh) // 2
        im = im.crop((0, y, w, y + nh))
    return im


def main() -> None:
    for src, name in SHOTS.items():
        im = _prepare(RAW / src)
        for width in WIDTHS:
            out = OUT / f"{name}-{width}.webp"
            im.resize((width, width * 9 // 16), Image.LANCZOS).save(
                out, "WEBP", quality=QUALITY, method=6
            )
            print(f"{out.name}: {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
