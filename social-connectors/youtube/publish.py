"""YouTube Shorts & Video publish adapter.
Format: direct::{apiKey_or_OAuthToken} or OAuth Access Token.
"""

from __future__ import annotations


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    # Only tokens minted by the dev-mock connect flow; a real credential that
    # merely contains "mock" (e.g. a password) must never be faked.
    if access_token.startswith("dev_mock_"):
        fake_id = f"yt_{abs(hash(text)) % 10000000}"
        return f"https://youtube.com/shorts/{fake_id}"

    # No real upload is implemented yet. Fail loudly rather than returning a
    # made-up post URL that would tell the user something was published.
    raise NotImplementedError(
        "YouTube publishing is not implemented yet; connect a dev-mock account to test pipelines"
    )
