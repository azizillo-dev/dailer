import io
import secrets
from pathlib import Path

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import AppError

MAX_BYTES = 5 * 1024 * 1024
ROOT = Path(settings.upload_dir)


def public_url(rel: str) -> str:
    return f"{settings.public_url.rstrip('/')}/uploads/{rel}"


def _process(data: bytes, size: tuple[int, int] | None, square: bool) -> bytes:
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
    except (UnidentifiedImageError, OSError) as exc:
        raise AppError("invalid_image", 422) from exc
    img = img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img
    if square and size:
        img = ImageOps.fit(img, size, Image.Resampling.LANCZOS)
    elif size:
        img.thumbnail(size, Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, "WEBP", quality=85, method=4)
    return out.getvalue()


async def save_image(
    file: UploadFile, folder: str, size: tuple[int, int] | None = None, square: bool = False
) -> str:
    """Rasmni tekshiradi, kesadi/kichraytiradi, WEBP qilib saqlaydi. Nisbiy yo'lni qaytaradi."""
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise AppError("file_too_large", 413)
    webp = await run_in_threadpool(_process, data, size, square)
    target = ROOT / folder
    target.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(12)}.webp"
    (target / name).write_bytes(webp)
    return f"{folder}/{name}"


def remove(url: str | None) -> None:
    """Faqat o'zimiz yuklagan faylni o'chiradi (masalan Google avatari emas)."""
    prefix = public_url("")
    if not url or not url.startswith(prefix):
        return
    path = (ROOT / url[len(prefix):]).resolve()
    if ROOT.resolve() in path.parents and path.exists():
        path.unlink()
