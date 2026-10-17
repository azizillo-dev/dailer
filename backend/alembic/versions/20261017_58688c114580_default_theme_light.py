"""default theme light

Yangi yorqin dizayn: standart mavzu — yorug'. Hech qachon tanlov qilmagan (system) profillar ham yorug'ga o'tadi.

Revision ID: 58688c114580
Revises: 59329628e737
Create Date: 2026-10-17 19:11:14.793920
"""
from collections.abc import Sequence

from alembic import op


revision: str = '58688c114580'
down_revision: str | None = '59329628e737'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE profiles SET theme = 'light' WHERE theme = 'system'")


def downgrade() -> None:
    # Qaysi profil avval system bo'lganini bilib bo'lmaydi — o'zgarishsiz qoladi
    pass
