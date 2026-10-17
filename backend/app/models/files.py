from datetime import datetime

from sqlalchemy import DateTime, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StoredFile(Base):
    """Yuklangan rasm (UPLOAD_STORAGE=db). Diski vaqtinchalik bo'lgan hosting uchun; rasmlar WEBP, kichik."""

    __tablename__ = "stored_files"

    path: Mapped[str] = mapped_column(String(200), primary_key=True)  # "avatars/ab12….webp"
    data: Mapped[bytes] = mapped_column(LargeBinary)
    content_type: Mapped[str] = mapped_column(String(64), default="image/webp")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
