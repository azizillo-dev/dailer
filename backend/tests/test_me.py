from tests.conftest import auth, register

API = "/api/v1"


async def test_update_profile_partial(client):
    access = (await register(client))["tokens"]["access_token"]
    res = await client.patch(
        f"{API}/me/profile",
        json={"language": "ru", "city": "Toshkent", "interests": ["reading", "nope", "reading"]},
        headers=auth(access),
    )
    assert res.status_code == 200
    profile = res.json()["profile"]
    assert profile["language"] == "ru"
    assert profile["city"] == "Toshkent"
    assert profile["interests"] == ["reading"]
    assert profile["full_name"] == "Ali"


async def test_invalid_timezone(client):
    access = (await register(client))["tokens"]["access_token"]
    res = await client.patch(
        f"{API}/me/profile", json={"timezone": "Mars/Base"}, headers=auth(access)
    )
    assert res.status_code == 422


async def test_onboarding(client):
    access = (await register(client))["tokens"]["access_token"]

    incomplete = await client.post(
        f"{API}/me/onboarding", json={"user_type": "university_student"}, headers=auth(access)
    )
    assert incomplete.status_code == 422

    res = await client.post(
        f"{API}/me/onboarding",
        json={
            "user_type": "university_student",
            "birth_year": 2005,
            "wake_time": "05:00",
            "sleep_time": "23:00",
            "prays": True,
            "main_goal": "Yaxshi dasturchi bo'lish",
            "interests": ["programming", "reading"],
        },
        headers=auth(access),
    )
    assert res.status_code == 200
    profile = res.json()["profile"]
    assert profile["main_goal"] == "Yaxshi dasturchi bo'lish"
    assert profile["onboarding_completed_at"] is not None
    assert profile["wake_time"] == "05:00:00"
