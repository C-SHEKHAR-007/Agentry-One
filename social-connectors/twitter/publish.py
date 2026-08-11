"""X (Twitter) publish adapter. Loaded dynamically by python/sdk/social_connectors.py --
see agents/social-publisher/worker.py for the caller."""

import requests


def post(access_token: str, text: str) -> str:
    resp = requests.post(
        "https://api.twitter.com/2/tweets",
        json={"text": text},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    resp.raise_for_status()
    tweet_id = resp.json()["data"]["id"]
    return f"https://twitter.com/i/web/status/{tweet_id}"
