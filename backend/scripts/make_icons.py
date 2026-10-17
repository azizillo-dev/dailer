"""PWA / bildirishnoma ikonkalari (chiqayotgan quyosh belgisi).

    python -m scripts.make_icons ../apps/web/public
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ESPRESSO = (43, 29, 20)
CARAMEL = (192, 133, 82)
CREAM = (247, 240, 230)


def icon(size: int, maskable: bool) -> Image.Image:
    scale = 4  # silliq qirralar uchun katta chizib, keyin kichraytiramiz
    s = size * scale
    img = Image.new("RGB", (s, s), ESPRESSO)
    d = ImageDraw.Draw(img)
    if not maskable:
        img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((0, 0, s, s), radius=int(s * 0.22), fill=ESPRESSO)
    pad = s * (0.24 if maskable else 0.2)
    w = s - 2 * pad
    cx = s / 2
    r = w * 0.42
    base = s * 0.6
    # Yarim doira (quyosh)
    d.pieslice((cx - r, base - r, cx + r, base + r), 180, 360, fill=CARAMEL)
    # Ufq chizig'i
    h = w * 0.085
    d.rounded_rectangle((pad, base + w * 0.08, s - pad, base + w * 0.08 + h), radius=h / 2, fill=CREAM)
    return img.resize((size, size), Image.Resampling.LANCZOS)


out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
out.mkdir(parents=True, exist_ok=True)
icon(192, False).save(out / "icon-192.png")
icon(512, False).save(out / "icon-512.png")
icon(512, True).save(out / "icon-maskable-512.png")
icon(180, True).save(out / "apple-touch-icon.png")
icon(96, False).save(out / "badge-96.png")
print("ok", out)
