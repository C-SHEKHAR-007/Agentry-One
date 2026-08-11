"""LinkedIn publish adapter. Loaded dynamically by python/sdk/social_connectors.py --
see agents/social-publisher/worker.py for the caller."""

import requests


def post(access_token: str, text: str) -> str:
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
