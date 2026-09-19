import pytest
import base64
from unittest.mock import patch, MagicMock
from sdk.providers import CapabilityClient, ImageGenResult

@pytest.fixture
def mock_requests():
    with patch("requests.post") as mock_post, patch("requests.get") as mock_get:
        yield mock_post, mock_get

import sys

@pytest.fixture
def mock_pyttsx3():
    mock_module = MagicMock()
    sys.modules["pyttsx3"] = mock_module
    yield mock_module.init
    del sys.modules["pyttsx3"]

def test_generate_image_openai_dalle(mock_requests):
    mock_post, mock_get = mock_requests
    
    # Setup post response (Returns URL)
    mock_post_response = MagicMock()
    mock_post_response.json.return_value = {
        "data": [{"url": "https://mock-cdn.openai.com/image.png"}]
    }
    mock_post.return_value = mock_post_response

    # Setup get response (Returns Image Bytes)
    mock_get_response = MagicMock()
    mock_get_response.content = b"fake_image_bytes"
    mock_get.return_value = mock_get_response

    client = CapabilityClient({
        "providerType": "dalle",
        "secret": "sk-dalle",
        "config": {"model": "dall-e-3"}
    })

    result = client.generate_image("A cute cat")
    
    assert isinstance(result, ImageGenResult)
    assert result.image_bytes == b"fake_image_bytes"
    assert result.width == 1024
    assert result.height == 1024

    mock_post.assert_called_once()
    mock_get.assert_called_once_with("https://mock-cdn.openai.com/image.png", timeout=60)

def test_generate_image_stability(mock_requests):
    mock_post, _ = mock_requests
    
    # Setup post response (Returns Base64 directly)
    fake_base64 = base64.b64encode(b"fake_stability_bytes").decode("utf-8")
    mock_post_response = MagicMock()
    mock_post_response.json.return_value = {
        "artifacts": [{"base64": fake_base64, "width": 512, "height": 512}]
    }
    mock_post.return_value = mock_post_response

    client = CapabilityClient({
        "providerType": "stability",
        "apiKey": "sk-stability"
    })

    result = client.generate_image("A cool dog", steps=10)
    
    assert isinstance(result, ImageGenResult)
    assert result.image_bytes == b"fake_stability_bytes"
    assert result.width == 512
    assert result.height == 512

    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert "api.stability.ai" in args[0]
    assert kwargs["json"]["steps"] == 10

def test_generate_audio_pyttsx3(mock_pyttsx3, tmp_path):
    mock_engine = MagicMock()
    mock_pyttsx3.return_value = mock_engine

    # Configure engine properties
    mock_voice = MagicMock()
    mock_voice.name = "english-us"
    mock_voice.id = "en-us"
    mock_engine.getProperty.return_value = [mock_voice]

    client = CapabilityClient({
        "providerType": "local"
    })

    out_path = str(tmp_path / "output.wav")
    
    result = client.generate_audio("Hello world", out_path, voice="english")
    
    assert result == out_path
    
    mock_pyttsx3.assert_called_once()
    mock_engine.setProperty.assert_called_with("voice", "en-us")
    mock_engine.save_to_file.assert_called_with("Hello world", out_path)
    mock_engine.runAndWait.assert_called_once()
