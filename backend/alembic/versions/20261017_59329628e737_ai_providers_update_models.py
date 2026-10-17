"""ai providers update models

Groq llama-3.3-70b-versatile olib tashlandi, Gemini 2.5 Flash yangi foydalanuvchilarga yopildi.
Faqat admin o'zgartirmagan (eski standart qiymatdagi) yozuvlar yangilanadi.

Revision ID: 59329628e737
Revises: 7e236ab15a09
Create Date: 2026-10-17 18:31:34.236900
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '59329628e737'
down_revision: str | None = '7e236ab15a09'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (code, eski model, yangi model, yangi priority)
CHANGES = [
    ("groq", "llama-3.3-70b-versatile", "openai/gpt-oss-120b", 10),
    ("gemini", "gemini-2.5-flash", "gemini-flash-lite-latest", 20),
]


def upgrade() -> None:
    for code, old, new, priority in CHANGES:
        op.execute(
            sa.text("UPDATE ai_providers SET model = :new, priority = :p WHERE code = :code AND model = :old")
            .bindparams(new=new, p=priority, code=code, old=old)
        )


def downgrade() -> None:
    old_priority = {"groq": 20, "gemini": 10}
    for code, old, new, _ in CHANGES:
        op.execute(
            sa.text("UPDATE ai_providers SET model = :old, priority = :p WHERE code = :code AND model = :new")
            .bindparams(old=old, p=old_priority[code], code=code, new=new)
        )
