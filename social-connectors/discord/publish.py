"""Discord publish adapter supporting Webhook URL or Bot Token + Channel ID.
Format: Webhook URL or bot_token::channel_id
"""

from __future__ import annotations
import requests


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    if access_token.startswith("dev_mock_") or "mock" in access_token:
        return "https://discord.com/channels/123456789/987654321"

    token_str = access_token.replace("direct::", "").strip()

    # Webhook URL support
    if token_str.startswith("https://discord.com/api/webhooks/") or token_str.startswith("https://discordapp.com/api/webhooks/"):
        payload: dict = {"content": text}
        if media_url:
            payload["embeds"] = [{"image": {"url": media_url}}]
        resp = requests.post(token_str, json=payload, timeout=30)
        resp.raise_for_status()
        return "https://discord.com/channels/@me"

    # Bot Token + Channel ID
    parts = token_str.split("::")
    bot_token = parts[0].strip()
    channel_id = parts[1].strip() if len(parts) > 1 else ""

    payload = {"content": text}
    if media_url:
        payload["embeds"] = [{"image": {"url": media_url}}]

    resp = requests.post(
        f"https://discord.com/api/v10/channels/{channel_id}/messages",
        headers={"Authorization": f"Bot {bot_token}"},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    msg_id = resp.json().get("id", "")
    return f"https://discord.com/channels/{channel_id}/{msg_id}"
