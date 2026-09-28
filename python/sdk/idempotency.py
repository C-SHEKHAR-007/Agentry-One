"""At-most-once guard for side-effecting steps (e.g. publishing a post).

BullMQ re-runs a job whose lock expired (worker crash, OOM, a blocked event
loop, a restart mid-job) -- the stalled-job recovery ignores `attempts`. For
a step that posts publicly that means a duplicate post. The guard records a
marker in Redis *before* the side effect and the result *after* it:

- no marker      -> first attempt: claim it and run
- "done:<value>" -> already succeeded: return the recorded result, don't re-run
- "started"      -> a previous attempt began but never confirmed: it may have
                    posted, so refuse to repeat it automatically.
"""

from __future__ import annotations

import os

MARKER_TTL_SEC = 14 * 24 * 3600


class AlreadyAttempted(RuntimeError):
    pass


def _client():
    import redis.asyncio as redis

    return redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))


async def run_once(key: str, action):
    """Runs the zero-arg awaitable factory `action` at most once for `key`
    and returns its (string) result; a completed earlier run's result is
    returned without calling `action` again."""
    client = _client()
    full_key = f"agentry:once:{key}"
    try:
        claimed = await client.set(full_key, "started", nx=True, ex=MARKER_TTL_SEC)
        if not claimed:
            existing = (await client.get(full_key) or b"").decode("utf-8")
            if existing.startswith("done:"):
                return existing[len("done:"):]
            raise AlreadyAttempted(
                "a previous attempt of this step started but never confirmed completion; it may already "
                "have taken effect, so it is not being repeated automatically -- check the destination, "
                "then re-run the workflow if needed"
            )
        result = await action()
        await client.set(full_key, f"done:{result}", ex=MARKER_TTL_SEC)
        return result
    finally:
        await client.aclose()
