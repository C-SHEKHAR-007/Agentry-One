"""X (Twitter) publish adapter. Loaded dynamically by python/sdk/social_connectors.py --
see agents/social-publisher/worker.py for the caller."""

from __future__ import annotations

import requests


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    # media_url: not wired up yet -- X's media upload needs the separate
    # v1.1 endpoint (see agents/social-publisher/worker.py's original note);
    # accepted here only to keep post()'s signature uniform across platforms.
    del media_url
    resp = requests.post(
        "https://api.twitter.com/2/tweets",
        json={"text": text},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    resp.raise_for_status()
    tweet_id = resp.json()["data"]["id"]
    return f"https://twitter.com/i/web/status/{tweet_id}"
