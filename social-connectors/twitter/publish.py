"""X (Twitter) publish adapter supporting both direct API keys / Bearer tokens and standard OAuth2."""

from __future__ import annotations
import requests


def post(access_token: str, text: str, media_url: str | None = None) -> str:
    # 1. Dev mock simulation
    if access_token.startswith("dev_mock_") or "mock" in access_token:
        fake_id = f"{abs(hash(text)) % 1000000000000000000}"
        return f"https://twitter.com/i/web/status/{fake_id}"

    # 2. Check if direct API Key / Secret pair was provided: "api_key:api_secret:access_token:access_token_secret"
    if access_token.startswith("direct::") or access_token.count(":") >= 3:
        parts = access_token.replace("direct::", "").split(":")
        if len(parts) >= 4:
            import tweepy
            api_key, api_secret, user_token, user_secret = parts[:4]
            client = tweepy.Client(
                consumer_key=api_key,
                consumer_secret=api_secret,
                access_token=user_token,
                access_token_secret=user_secret,
            )
            media_ids = []
            if media_url:
                import os
                local_file = media_url
                if (media_url.startswith("http://") or media_url.startswith("https://")) and not os.path.exists(media_url):
                    import tempfile
                    res = requests.get(media_url, timeout=60)
                    if res.ok:
                        temp_m = tempfile.NamedTemporaryFile(delete=False)
                        temp_m.write(res.content)
                        temp_m.close()
                        local_file = temp_m.name
                if os.path.isfile(local_file):
                    try:
                        auth = tweepy.OAuth1UserHandler(api_key, api_secret, user_token, user_secret)
                        api = tweepy.API(auth)
                        media_upload = api.media_upload(local_file)
                        media_ids = [media_upload.media_id]
                    except Exception:
                        pass
            resp = client.create_tweet(text=text, media_ids=media_ids if media_ids else None)
            tweet_id = resp.data["id"]
            return f"https://twitter.com/i/web/status/{tweet_id}"

    # 3. Standard OAuth2 / Bearer token
    resp = requests.post(
        "https://api.twitter.com/2/tweets",
        json={"text": text},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    resp.raise_for_status()
    tweet_id = resp.json()["data"]["id"]
    return f"https://twitter.com/i/web/status/{tweet_id}"
