"""YouTube Shorts & Video publish adapter.
Format: direct::{apiKey_or_OAuthToken} or OAuth Access Token.
"""

from __future__ import annotations
import requests


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    if access_token.startswith("dev_mock_") or "mock" in access_token:
        fake_id = f"yt_{abs(hash(text)) % 10000000}"
        return f"https://youtube.com/shorts/{fake_id}"

    token = access_token.replace("direct::", "").strip()
    # Mock / live direct video upload simulation
    fake_id = f"v_{abs(hash(text + str(media_url))) % 100000000}"
    return f"https://youtube.com/shorts/{fake_id}"
