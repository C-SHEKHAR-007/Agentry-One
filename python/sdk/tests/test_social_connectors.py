import pytest
from pathlib import Path
from sdk import social_connectors
from sdk.social_connectors import load_publisher

def test_load_publisher_not_found(monkeypatch, tmp_path):
    monkeypatch.setattr(social_connectors, "SOCIAL_CONNECTORS_DIR", tmp_path)
    
    with pytest.raises(NotImplementedError, match="no publish adapter for platform 'unknown'"):
        load_publisher("unknown")

def test_load_publisher_success(monkeypatch, tmp_path):
    monkeypatch.setattr(social_connectors, "SOCIAL_CONNECTORS_DIR", tmp_path)
    
    # Create a mock connector
    twitter_dir = tmp_path / "twitter"
    twitter_dir.mkdir()
    publish_py = twitter_dir / "publish.py"
    
    publish_py.write_text("""
def post(access_token, text, media_url=None):
    return f"mock_post_url_{text}"
""")

    post_fn = load_publisher("twitter")
    assert callable(post_fn)
    assert post_fn("token", "hello") == "mock_post_url_hello"
