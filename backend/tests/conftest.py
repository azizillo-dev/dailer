import inspect
import os
import re

# Sozlamalar import paytida o'qiladi — app'dan oldin o'rnatamiz
os.environ["ENV"] = "test"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://dailer:dailer@localhost:5433/dailer_test"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"
os.environ["SUPERADMIN_EMAIL"] = "boss@dailer.uz"

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import email as mailer  # noqa: E402
from app.services.redis import redis  # noqa: E402


def pytest_collection_modifyitems(items):
    # Barcha testlar bitta event loop'da — DB va Redis ulanishlari loop'lar orasida buzilmasin
    for item in items:
        if inspect.iscoroutinefunction(getattr(item, "obj", None)):
            item.add_marker(pytest.mark.asyncio(loop_scope="session"), append=False)


@pytest.fixture(scope="session", autouse=True)
async def _schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean():
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    await redis.flushdb()
    mailer.outbox.clear()
    yield


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def last_email_token() -> str:
    body = mailer.outbox[-1].get_body(preferencelist=("plain",)).get_content()
    match = re.search(r"token=([\w-]+)", body)
    assert match, body
    return match.group(1)


async def register(client: AsyncClient, email="ali@example.com", password="Parol1234", name="Ali"):
    res = await client.post(
        "/api/v1/auth/register", json={"full_name": name, "email": email, "password": password}
    )
    assert res.status_code == 201, res.text
    return res.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
