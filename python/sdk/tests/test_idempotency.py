import asyncio
import os
import uuid

import pytest

redis = pytest.importorskip("redis")

from sdk.idempotency import AlreadyAttempted, run_once

REDIS_URL = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/6")


def _redis_available() -> bool:
    try:
        redis.Redis.from_url(REDIS_URL, socket_connect_timeout=1).ping()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _redis_available(), reason="needs a Redis at TEST_REDIS_URL")


@pytest.fixture(autouse=True)
def _redis_env(monkeypatch):
    monkeypatch.setenv("REDIS_URL", REDIS_URL)


def test_runs_once_and_replays_result():
    key = f"test:{uuid.uuid4()}"
    calls = []

    async def action():
        calls.append(1)
        return "https://example.com/post/1"

    assert asyncio.run(run_once(key, action)) == "https://example.com/post/1"
    # A re-run of the same job (e.g. BullMQ stalled-job recovery) must not post again.
    assert asyncio.run(run_once(key, action)) == "https://example.com/post/1"
    assert len(calls) == 1


def test_unconfirmed_attempt_is_not_repeated():
    key = f"test:{uuid.uuid4()}"

    async def crashes():
        raise RuntimeError("worker died mid-post")

    with pytest.raises(RuntimeError):
        asyncio.run(run_once(key, crashes))

    async def should_not_run():
        pytest.fail("a possibly-completed side effect must not be repeated")

    with pytest.raises(AlreadyAttempted):
        asyncio.run(run_once(key, should_not_run))
