"""Facebook Pages publish adapter supporting Page Access Token and Page ID.
Format: page_token::page_id or direct page access token.
"""

from __future__ import annotations
import requests

GRAPH_VERSION = "v19.0"


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    if access_token.startswith("dev_mock_") or "mock" in access_token:
        fake_id = abs(hash(text)) % 1000000000
        return f"https://facebook.com/posts/{fake_id}"

    parts = access_token.replace("direct::", "").split("::")
    page_token = parts[0].strip()
    page_id = parts[1].strip() if len(parts) > 1 and parts[1].strip() else "me"

    if media_url:
        is_video = any(ext in media_url.lower() for ext in [".mp4", ".mov", ".mkv", "video"])
        if is_video:
            resp = requests.post(
                f"https://graph.facebook.com/{GRAPH_VERSION}/{page_id}/videos",
                data={"access_token": page_token, "description": text, "file_url": media_url},
                timeout=60,
            )
        else:
            resp = requests.post(
                f"https://graph.facebook.com/{GRAPH_VERSION}/{page_id}/photos",
                data={"access_token": page_token, "caption": text, "url": media_url},
                timeout=30,
            )
    else:
        resp = requests.post(
            f"https://graph.facebook.com/{GRAPH_VERSION}/{page_id}/feed",
            data={"access_token": page_token, "message": text},
            timeout=30,
        )

    resp.raise_for_status()
    post_id = resp.json().get("id", "")
    return f"https://facebook.com/{post_id}"
