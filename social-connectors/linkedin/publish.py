"""LinkedIn publish adapter. Loaded dynamically by python/sdk/social_connectors.py --
see agents/social-publisher/worker.py for the caller."""

from __future__ import annotations

import requests


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    # media_url: not wired up yet -- LinkedIn's Images API needs a separate
    # register-upload/PUT-binary/reference-asset sequence; accepted here
    # only to keep post()'s signature uniform across platforms.
    del media_url
    userinfo = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    userinfo.raise_for_status()
    author_urn = f"urn:li:person:{userinfo.json()['sub']}"

    resp = requests.post(
        "https://api.linkedin.com/rest/posts",
        json={
            "author": author_urn,
            "commentary": text,
            "visibility": "PUBLIC",
            "distribution": {"feedDistribution": "MAIN_FEED"},
            "lifecycleState": "PUBLISHED",
        },
        headers={
            "Authorization": f"Bearer {access_token}",
            "LinkedIn-Version": "202401",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        timeout=30,
    )
    resp.raise_for_status()
    post_id = resp.headers.get("x-restli-id", "")
    return f"https://www.linkedin.com/feed/update/{post_id}"
