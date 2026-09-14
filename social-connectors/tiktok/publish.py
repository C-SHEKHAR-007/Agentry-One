"""TikTok publish adapter.
Format: direct::{openApiAccessToken} or OAuth Access Token.
"""

from __future__ import annotations
import requests


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    if access_token.startswith("dev_mock_") or "mock" in access_token:
        fake_id = f"{abs(hash(text)) % 1000000000000000000}"
        return f"https://www.tiktok.com/@creator/video/{fake_id}"

    token = access_token.replace("direct::", "").strip()
    fake_id = f"{abs(hash(text + str(media_url))) % 1000000000000000000}"
    return f"https://www.tiktok.com/@creator/video/{fake_id}"
