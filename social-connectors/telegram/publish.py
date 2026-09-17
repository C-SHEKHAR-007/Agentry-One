"""Telegram publish adapter supporting Bot Token and Channel/Chat ID.
Format: bot_token::chat_id or bot_token
"""

from __future__ import annotations
import requests


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    if access_token.startswith("dev_mock_") or "mock" in access_token:
        fake_id = abs(hash(text)) % 1000000
        return f"https://t.me/agentry_feed/{fake_id}"

    parts = access_token.replace("direct::", "").split("::")
    bot_token = parts[0].strip()
    chat_id = parts[1].strip() if len(parts) > 1 and parts[1].strip() else "@agentry_feed"

    if media_url:
        import os
        is_video = any(ext in media_url.lower() for ext in [".mp4", ".mov", ".mkv", "video"])
        endpoint = "sendVideo" if is_video else "sendPhoto"
        field_name = "video" if is_video else "photo"
        if os.path.isfile(media_url):
            with open(media_url, "rb") as f:
                resp = requests.post(
                    f"https://api.telegram.org/bot{bot_token}/{endpoint}",
                    data={"chat_id": chat_id, "caption": text},
                    files={field_name: f},
                    timeout=60,
                )
        else:
            resp = requests.post(
                f"https://api.telegram.org/bot{bot_token}/{endpoint}",
                data={"chat_id": chat_id, "caption": text, field_name: media_url},
                timeout=30,
            )
    else:
        resp = requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=30,
        )

    resp.raise_for_status()
    result = resp.json().get("result", {})
    message_id = result.get("message_id", "")
    clean_chat = chat_id.replace("@", "")
    return f"https://t.me/{clean_chat}/{message_id}"
