"""Dailer ikonkalari — chiqayotgan quyosh belgisi ("Krem tong" palitrasi).

    python -m scripts.make_icons web ../apps/web/public
    python -m scripts.make_icons mobile ../apps/mobile/assets

Krem fon, o'rik→marjon gradientli quyosh, espresso ufq chizig'i.
Bildirishnoma ikonkalari (badge, notification-icon) — oq siluet (Android talabi).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

CREAM = (255, 248, 239)
ESPRESSO = (42, 31, 23)
SUN_TOP = (255, 186, 102)  # o'rik
SUN_BOTTOM = (240, 106, 58)  # marjon
WHITE = (255, 255, 255)
SCALE = 4  # silliq qirralar uchun katta chizib, keyin kichraytiramiz


def _sun_layer(s: int, box: tuple[float, float, float, float]) -> Image.Image:
    """Gradientli yarim doira (shaffof fonda)."""
    x0, y0, x1, y1 = box
    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    top, bottom = int(y0), int((y0 + y1) / 2)
    for y in range(top, bottom + 1):
        t = (y - top) / max(1, bottom - top)
        c = tuple(round(a + (b - a) * t) for a, b in zip(SUN_TOP, SUN_BOTTOM))
        gd.line((0, y, s, y), fill=(*c, 255))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).pieslice(box, 180, 360, fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out


def mark(size: int, pad: float, bg: tuple | None, radius: float = 0, mono: bool = False) -> Image.Image:
    """pad — chetdan bo'sh joy (o'lchamga nisbatan); bg=None — shaffof; mono — oq siluet."""
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg is not None:
        if radius:
            d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius), fill=(*bg, 255))
        else:
            d.rectangle((0, 0, s, s), fill=(*bg, 255))
    p = s * pad
    w = s - 2 * p
    cx, r = s / 2, w * 0.42
    base = p + w * 0.6
    box = (cx - r, base - r, cx + r, base + r)
    if mono:
        d.pieslice(box, 180, 360, fill=(*WHITE, 255))
    else:
        img.alpha_composite(_sun_layer(s, box))
        d = ImageDraw.Draw(img)
    h = w * 0.085
    line = (p, base + w * 0.08, s - p, base + w * 0.08 + h)
    d.rounded_rectangle(line, radius=h / 2, fill=(*(WHITE if mono else ESPRESSO), 255))
    return img.resize((size, size), Image.Resampling.LANCZOS)


def web(out: Path) -> None:
    mark(192, 0.2, CREAM, radius=0.22).save(out / "icon-192.png")
    mark(512, 0.2, CREAM, radius=0.22).save(out / "icon-512.png")
    mark(512, 0.24, CREAM).save(out / "icon-maskable-512.png")
    mark(180, 0.2, CREAM).convert("RGB").save(out / "apple-touch-icon.png")
    mark(96, 0.12, None, mono=True).save(out / "badge-96.png")
    fav = mark(256, 0.12, CREAM, radius=0.22)
    fav.save(out.parent / "src" / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])


def mobile(out: Path) -> None:
    mark(1024, 0.2, CREAM).convert("RGB").save(out / "icon.png")
    # Android adaptive: oldingi qatlam shaffof, xavfsiz zona (66%) ichida; fon rangi app.json'da
    mark(1024, 0.3, None).save(out / "adaptive-icon.png")
    mark(1024, 0.2, None).save(out / "splash-icon.png")
    mark(96, 0.12, None, mono=True).save(out / "notification-icon.png")
    mark(48, 0.12, CREAM, radius=0.22).save(out / "favicon.png")


if __name__ == "__main__":
    kind, target = sys.argv[1], Path(sys.argv[2])
    target.mkdir(parents=True, exist_ok=True)
    {"web": web, "mobile": mobile}[kind](target)
    print("ok", kind, target)
