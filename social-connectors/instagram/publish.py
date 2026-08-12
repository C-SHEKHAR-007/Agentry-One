"""Instagram publish adapter (Meta Graph API, via a linked Facebook Page's
Business/Creator account). Loaded dynamically by python/sdk/social_connectors.py
-- see agents/social-publisher/worker.py for the caller.

No connector.json here on purpose: the OAuth side (Facebook Login, page
lookup, short-lived -> long-lived token exchange) doesn't fit the generic
connector.json shape the other platforms use, so it's hand-written in
apps/api/src/modules/socialAccounts/adapters.ts instead. Only the publish
step lives here, following the same per-platform-directory convention."""

from __future__ import annotations

import time

import requests

GRAPH_VERSION = "v19.0"


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    """access_token is "{pageAccessToken}::{igBusinessAccountId}" -- see
    exchangeInstagramCode's comment in adapters.ts for why it's packed this
    way instead of a separate DB column."""
    if not media_url:
        raise ValueError(
            "Instagram posts require an image or video -- pass mediaUrl (a public URL) to the "
            "Social Publisher step; a caption alone can't be posted to Instagram's Feed API."
        )

    page_token, _, ig_account_id = access_token.partition("::")
    if not ig_account_id:
        raise ValueError("malformed Instagram account token (missing linked Instagram Business Account id)")

    container_res = requests.post(
        f"https://graph.facebook.com/{GRAPH_VERSION}/{ig_account_id}/media",
        data={"image_url": media_url, "caption": text, "access_token": page_token},
        timeout=30,
    )
    container_res.raise_for_status()
    creation_id = container_res.json()["id"]

    # Meta needs a moment to fetch and process the image before it can be published.
    for _ in range(10):
        status_res = requests.get(
            f"https://graph.facebook.com/{GRAPH_VERSION}/{creation_id}",
            params={"fields": "status_code", "access_token": page_token},
            timeout=15,
        )
        if status_res.ok and status_res.json().get("status_code") == "FINISHED":
            break
        time.sleep(2)

    publish_res = requests.post(
        f"https://graph.facebook.com/{GRAPH_VERSION}/{ig_account_id}/media_publish",
        data={"creation_id": creation_id, "access_token": page_token},
        timeout=30,
    )
    publish_res.raise_for_status()
    media_id = publish_res.json()["id"]

    permalink_res = requests.get(
        f"https://graph.facebook.com/{GRAPH_VERSION}/{media_id}",
        params={"fields": "permalink", "access_token": page_token},
        timeout=15,
    )
    if permalink_res.ok and permalink_res.json().get("permalink"):
        return permalink_res.json()["permalink"]
    return f"https://www.instagram.com/{ig_account_id}/"  # fallback if the permalink fetch itself fails
