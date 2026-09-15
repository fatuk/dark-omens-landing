# -*- coding: utf-8 -*-
"""Портреты для страниц хроник: сыщики и монстры из ассетов игры → images/portraits/.

Исходники @2× (1024px PNG, десятки МБ) на сайт не тащим — ужимаем до 384px WebP.
Имя файла = kebab-case английского имени (совпадает с id сыщика в CMS:
«Frank Dalton.png» → frank-dalton.webp; монстры — «Tick Tock Men.png» → tick-tock-men.webp).

Запуск из корня landing:  python tools/build-portraits.py
После появления нового арта в игре — перезапустить и закоммитить images/portraits.
"""
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LANDING = os.path.dirname(HERE)
GAME = os.path.join(os.path.dirname(LANDING), 'dark-omens', 'assets')
OUT = os.path.join(LANDING, 'images', 'portraits')
SIZE = 384
QUALITY = 82

SOURCES = {
    'investigators': os.path.join(GAME, 'investigators'),
    'monsters': os.path.join(GAME, 'monsters'),
}


def kebab(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for kind, src in SOURCES.items():
        if not os.path.isdir(src):
            print(f'missing folder {src}', file=sys.stderr)
            continue
        dst = os.path.join(OUT, kind)
        os.makedirs(dst, exist_ok=True)
        for fn in sorted(os.listdir(src)):
            if not fn.lower().endswith('.png'):
                continue
            out = os.path.join(dst, kebab(fn[:-4]) + '.webp')
            im = Image.open(os.path.join(src, fn)).convert('RGB')
            im.thumbnail((SIZE, SIZE), Image.LANCZOS)
            im.save(out, 'WEBP', quality=QUALITY, method=6)
            total += 1
    print(f'done: {total} portraits -> {OUT}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
