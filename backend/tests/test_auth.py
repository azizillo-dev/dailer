import pyotp

from app.services import email as mailer
from tests.conftest import auth, last_email_token, register

API = "/api/v1"


async def test_register_verify_and_me(client):
    data = await register(client)
    assert data["tokens"]["access_token"]
    assert data["requires_2fa"] is False
    assert len(mailer.outbox) == 1

    access = data["tokens"]["access_token"]
    me = (await client.get(f"{API}/me", headers=auth(access))).json()
    assert me["email"] == "ali@example.com"
    assert me["email_verified"] is False
    assert me["profile"]["language"] == "uz"

    res = await client.post(f"{API}/auth/verify-email", json={"token": last_email_token()})
    assert res.status_code == 200
    me = (await client.get(f"{API}/me", headers=auth(access))).json()
    assert me["email_verified"] is True


async def test_verify_token_single_use(client):
    await register(client)
    token = last_email_token()
    assert (await client.post(f"{API}/auth/verify-email", json={"token": token})).status_code == 200
    res = await client.post(f"{API}/auth/verify-email", json={"token": token})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_token"


async def test_duplicate_email_translated(client):
    await register(client)
    payload = {"full_name": "A", "email": "ALI@example.com", "password": "Parol1234"}

    res = await client.post(f"{API}/auth/register", json=payload)
    assert res.status_code == 409
    assert res.json()["error"]["message"] == "Bu email bilan allaqachon ro'yxatdan o'tilgan."

    res = await client.post(
        f"{API}/auth/register", json=payload, headers={"Accept-Language": "ru-RU,ru;q=0.9"}
    )
    assert res.json()["error"]["message"] == "Этот email уже зарегистрирован."


async def test_weak_password(client):
    res = await client.post(
        f"{API}/auth/register",
        json={"full_name": "A", "email": "a@example.com", "password": "abcdefgh"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "weak_password"


async def test_login(client):
    await register(client)
    bad = await client.post(f"{API}/auth/login", json={"email": "ali@example.com", "password": "x"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"

    unknown = await client.post(
        f"{API}/auth/login", json={"email": "no@example.com", "password": "Parol1234"}
    )
    assert unknown.status_code == 401

    ok = await client.post(
        f"{API}/auth/login", json={"email": "Ali@Example.com", "password": "Parol1234"}
    )
    assert ok.status_code == 200
    assert ok.json()["tokens"]["refresh_token"]


async def test_refresh_rotation_and_reuse_detection(client):
    data = await register(client)
    first = data["tokens"]["refresh_token"]

    res = await client.post(f"{API}/auth/refresh", json={"refresh_token": first})
    assert res.status_code == 200
    second = res.json()["refresh_token"]
    assert second != first

    # Eski token qayta ishlatildi → butun zanjir bekor
    res = await client.post(f"{API}/auth/refresh", json={"refresh_token": first})
    assert res.status_code == 401
    res = await client.post(f"{API}/auth/refresh", json={"refresh_token": second})
    assert res.status_code == 401


async def test_logout(client):
    data = await register(client)
    refresh = data["tokens"]["refresh_token"]
    assert (await client.post(f"{API}/auth/logout", json={"refresh_token": refresh})).status_code == 200
    res = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 401


async def test_forgot_and_reset_password(client):
    data = await register(client)
    old_refresh = data["tokens"]["refresh_token"]
    mailer.outbox.clear()

    # Noma'lum email — javob bir xil, xat yuborilmaydi
    res = await client.post(f"{API}/auth/forgot-password", json={"email": "no@example.com"})
    assert res.status_code == 200
    assert mailer.outbox == []

    await client.post(f"{API}/auth/forgot-password", json={"email": "ali@example.com"})
    assert len(mailer.outbox) == 1
    token = last_email_token()

    res = await client.post(
        f"{API}/auth/reset-password", json={"token": token, "password": "Yangi12345"}
    )
    assert res.status_code == 200

    old = await client.post(
        f"{API}/auth/login", json={"email": "ali@example.com", "password": "Parol1234"}
    )
    assert old.status_code == 401
    new = await client.post(
        f"{API}/auth/login", json={"email": "ali@example.com", "password": "Yangi12345"}
    )
    assert new.status_code == 200
    # Barcha eski sessiyalar yopilgan
    res = await client.post(f"{API}/auth/refresh", json={"refresh_token": old_refresh})
    assert res.status_code == 401


async def test_change_password(client):
    data = await register(client)
    access = data["tokens"]["access_token"]
    res = await client.post(
        f"{API}/auth/change-password",
        json={"current_password": "noto'g'ri", "new_password": "Yangi12345"},
        headers=auth(access),
    )
    assert res.status_code == 400
    res = await client.post(
        f"{API}/auth/change-password",
        json={"current_password": "Parol1234", "new_password": "Yangi12345"},
        headers=auth(access),
    )
    assert res.status_code == 200
    assert res.json()["access_token"]


async def test_login_rate_limit(client):
    await register(client)
    codes = []
    for _ in range(11):
        res = await client.post(
            f"{API}/auth/login", json={"email": "ali@example.com", "password": "xato"}
        )
        codes.append(res.status_code)
    assert codes[-1] == 429


async def test_superadmin_needs_verified_email_and_2fa(client):
    data = await register(client, email="boss@dailer.uz")
    access = data["tokens"]["access_token"]
    me = (await client.get(f"{API}/me", headers=auth(access))).json()
    # Email tasdiqlanmaguncha oddiy foydalanuvchi
    assert me["role"] == "user"

    await client.post(f"{API}/auth/verify-email", json={"token": last_email_token()})
    me = (await client.get(f"{API}/me", headers=auth(access))).json()
    assert me["role"] == "super_admin"

    # 2FA sozlanmagan admin — tokenlar beriladi, lekin sozlash talab qilinadi
    res = (await client.post(
        f"{API}/auth/login", json={"email": "boss@dailer.uz", "password": "Parol1234"}
    )).json()
    assert res["requires_2fa_setup"] is True
    access = res["tokens"]["access_token"]

    setup = (await client.post(f"{API}/auth/2fa/setup", headers=auth(access))).json()
    totp = pyotp.TOTP(setup["secret"])
    res = await client.post(
        f"{API}/auth/2fa/confirm", json={"code": totp.now()}, headers=auth(access)
    )
    assert res.status_code == 200
    backup_codes = res.json()["backup_codes"]
    assert len(backup_codes) == 8

    # Endi login 2 bosqichli
    res = (await client.post(
        f"{API}/auth/login", json={"email": "boss@dailer.uz", "password": "Parol1234"}
    )).json()
    assert res["requires_2fa"] is True
    assert res["tokens"] is None
    mfa = res["mfa_token"]

    bad = await client.post(f"{API}/auth/2fa/verify", json={"mfa_token": mfa, "code": "000000"})
    assert bad.status_code == 401
    ok = await client.post(f"{API}/auth/2fa/verify", json={"mfa_token": mfa, "code": totp.now()})
    assert ok.status_code == 200

    # Zaxira kod bir marta ishlaydi
    code = backup_codes[0]
    assert (await client.post(
        f"{API}/auth/2fa/verify", json={"mfa_token": mfa, "code": code}
    )).status_code == 200
    assert (await client.post(
        f"{API}/auth/2fa/verify", json={"mfa_token": mfa, "code": code}
    )).status_code == 401


async def test_protected_route_requires_token(client):
    res = await client.get(f"{API}/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "not_authenticated"


async def test_google_not_configured(client):
    res = await client.post(f"{API}/auth/google", json={"id_token": "x"})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "google_not_configured"
