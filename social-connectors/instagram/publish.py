"""Instagram publish adapter supporting both:
1. Direct Instagram Mobile Login (Username & Password via instagrapi) - No Facebook App or Meta Developer setup required!
2. Official Meta Graph API (Page Access Token :: IG Business Account ID)
3. Local Dev Mock Simulation
"""

from __future__ import annotations

import os
import time
import tempfile
from pathlib import Path
import requests

GRAPH_VERSION = "v19.0"


def _publish_via_instagrapi(username: str, password: str, text: str, media_url: str) -> str:
    """Publishes directly using Instagram mobile client (username & password) without needing a Meta Developer App."""
    try:
        from instagrapi import Client
    except ImportError:
        raise RuntimeError("instagrapi is required for direct username/password login. Please run: pip install instagrapi")

    cl = Client()
    # Configure realistic mobile user agent and device settings
    cl.delay_range = [1, 3]
    
    # Check if session exists in temp to reuse session cookies
    session_file = Path(tempfile.gettempdir()) / f"agentry_ig_session_{username}.json"
    if session_file.exists():
        try:
            cl.load_settings(session_file)
            cl.login(username, password)
        except Exception:
            cl.login(username, password)
            cl.dump_settings(session_file)
    else:
        cl.login(username, password)
        try:
            cl.dump_settings(session_file)
        except Exception:
            pass

    # Fetch/resolve media file path
    local_path = None
    if media_url.startswith("http://") or media_url.startswith("https://"):
        suffix = ".mp4" if any(ext in media_url.lower() for ext in [".mp4", ".mov", "video"]) else ".jpg"
        temp_media = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        res = requests.get(media_url, timeout=60)
        res.raise_for_status()
        temp_media.write(res.content)
        temp_media.close()
        local_path = temp_media.name
    else:
        local_path = media_url

    try:
        is_video = local_path.lower().endswith((".mp4", ".mov", ".mkv", ".avi"))
        if is_video:
            # Upload as Instagram Reel / Video
            media = cl.clip_upload(Path(local_path), caption=text)
        else:
            # Upload as Instagram Photo / Post
            media = cl.photo_upload(Path(local_path), caption=text)

        code = getattr(media, "code", None) or getattr(media, "id", "post")
        return f"https://www.instagram.com/p/{code}/"
    finally:
        if local_path and (media_url.startswith("http://") or media_url.startswith("https://")):
            try:
                os.remove(local_path)
            except Exception:
                pass


def _publish_via_meta_graph(page_token: str, ig_account_id: str, text: str, media_url: str) -> str:
    """Official Meta Graph API publishing for Business / Creator accounts."""
    container_res = requests.post(
        f"https://graph.facebook.com/{GRAPH_VERSION}/{ig_account_id}/media",
        data={"image_url": media_url, "caption": text, "access_token": page_token},
        timeout=30,
    )
    container_res.raise_for_status()
    creation_id = container_res.json()["id"]

    for _ in range(12):
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
    return f"https://www.instagram.com/{ig_account_id}/"


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    if not media_url:
        raise ValueError(
            "Instagram posts require an image or video -- pass mediaUrl (or visual artifact) to the "
            "Social Publisher step; a caption alone cannot be published to Instagram."
        )

    # 1. Dev mock simulation
    if access_token.startswith("dev_mock_") or "mock" in access_token:
        fake_id = f"C{abs(hash(text)) % 10000000000}"
        return f"https://www.instagram.com/p/{fake_id}/"

    # 2. Direct Username & Password Login
    if access_token.startswith("direct::") or "::" in access_token and not access_token.startswith("EA"):
        parts = access_token.split("::")
        if len(parts) >= 3 and parts[0] == "direct":
            username = parts[1]
            password = parts[2]
            return _publish_via_instagrapi(username, password, text, media_url)
        elif len(parts) == 2 and not parts[0].startswith("EAA"):
            # Format: username::password
            username, password = parts
            return _publish_via_instagrapi(username, password, text, media_url)

    # 3. Official Meta Graph API
    page_token, _, ig_account_id = access_token.partition("::")
    if not ig_account_id:
        raise ValueError("Malformed Instagram credentials. Use direct login (username::password) or Meta Graph token (page_token::ig_account_id)")

    return _publish_via_meta_graph(page_token, ig_account_id, text, media_url)
