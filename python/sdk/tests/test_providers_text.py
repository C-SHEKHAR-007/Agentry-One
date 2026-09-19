import pytest
from unittest.mock import patch, MagicMock
from requests.exceptions import HTTPError
from sdk.providers import CapabilityClient

@pytest.fixture
def mock_requests_post():
    with patch("requests.post") as mock_post:
        yield mock_post

def test_generate_text_openai_compatible(mock_requests_post):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "choices": [
            {"message": {"content": "Hello from OpenAI"}}
        ]
    }
    mock_requests_post.return_value = mock_response

    # Initialize client with OpenAI context
    client = CapabilityClient({
        "providerType": "openai",
        "secret": "sk-test",
        "config": {"model": "gpt-4"}
    })

    # Execute
    result = client.generate_text("Say hello")
    
    # Verify
    assert result == "Hello from OpenAI"
    mock_requests_post.assert_called_once()
    args, kwargs = mock_requests_post.call_args
    assert "api.openai.com" in args[0]
    assert kwargs["headers"]["Authorization"] == "Bearer sk-test"
    assert kwargs["json"]["model"] == "gpt-4"

def test_generate_text_anthropic(mock_requests_post):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "content": [
            {"type": "text", "text": "Hello from Claude"}
        ]
    }
    mock_requests_post.return_value = mock_response

    # Initialize client with Anthropic context
    client = CapabilityClient({
        "providerType": "anthropic",
        "secret": "sk-ant-test",
        "config": {"model": "claude-3-5-sonnet"}
    })

    # Execute
    result = client.generate_text("Say hello")
    
    # Verify
    assert result == "Hello from Claude"
    mock_requests_post.assert_called_once()
    args, kwargs = mock_requests_post.call_args
    assert "api.anthropic.com" in args[0]
    assert kwargs["headers"]["x-api-key"] == "sk-ant-test"
    assert kwargs["json"]["model"] == "claude-3-5-sonnet"

def test_generate_text_gemini(mock_requests_post):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "candidates": [
            {"content": {"parts": [{"text": "Hello from Gemini"}]}}
        ]
    }
    mock_requests_post.return_value = mock_response

    # Initialize client with Gemini context
    client = CapabilityClient({
        "providerType": "gemini",
        "secret": "gemini-key",
        "config": {"model": "gemini-1.5-pro"}
    })

    # Execute
    result = client.generate_text("Say hello")
    
    # Verify
    assert result == "Hello from Gemini"
    mock_requests_post.assert_called_once()
    args, kwargs = mock_requests_post.call_args
    assert "generativelanguage.googleapis.com" in args[0]
    assert "key=gemini-key" in args[0]

def test_generate_text_ollama_local(mock_requests_post):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "response": "Hello from Ollama"
    }
    mock_requests_post.return_value = mock_response

    # Initialize client with Ollama context
    client = CapabilityClient({
        "providerType": "ollama",
        "baseUrl": "http://localhost:11434",
        "config": {"model": "qwen2.5"}
    })

    # Execute
    result = client.generate_text("Say hello")
    
    # Verify
    assert result == "Hello from Ollama"
    mock_requests_post.assert_called_once()
    args, kwargs = mock_requests_post.call_args
    assert "localhost:11434/api/generate" in args[0]
    assert kwargs["json"]["model"] == "qwen2.5"

def test_generate_text_http_error(mock_requests_post):
    # Setup mock to raise HTTPError when raise_for_status is called
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = HTTPError("401 Unauthorized")
    mock_requests_post.return_value = mock_response

    client = CapabilityClient({
        "providerType": "openai",
        "secret": "invalid-key"
    })

    with pytest.raises(HTTPError, match="401 Unauthorized"):
        client.generate_text("Say hello")
