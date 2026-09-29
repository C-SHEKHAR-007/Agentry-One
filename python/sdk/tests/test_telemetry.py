import asyncio
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

from sdk import telemetry
from sdk.providers import CapabilityClient
from sdk.runner import attach_usage


def _ollama_response():
    res = MagicMock()
    res.json.return_value = {"model": "qwen3:8b", "response": "hi", "prompt_eval_count": 12, "eval_count": 30}
    res.raise_for_status.return_value = None
    return res


def test_summary_is_none_without_calls():
    assert telemetry.JobTelemetry().summary() is None


def test_records_tokens_and_distinct_models():
    t = telemetry.JobTelemetry()
    t.record("qwen3:8b", 10, 5)
    t.record("qwen3:8b", 2, 3)
    t.record("stabilityai/sd-turbo")
    assert t.summary() == {"model": "qwen3:8b, stabilityai/sd-turbo", "inputTokens": 12, "outputTokens": 8, "calls": 3}


def test_media_only_jobs_report_no_token_counts():
    t = telemetry.JobTelemetry()
    t.record("pyttsx3 (local TTS)")
    assert t.summary() == {"model": "pyttsx3 (local TTS)", "inputTokens": None, "outputTokens": None, "calls": 1}


@patch("requests.post")
def test_client_records_usage_from_an_executor_thread(mock_post):
    """Handlers call providers via run_in_executor, where contextvars don't
    propagate -- the client must still record into the job's telemetry."""
    mock_post.return_value = _ollama_response()

    async def handler():
        usage, token = telemetry.begin()
        try:
            client = CapabilityClient({"providerType": "ollama_local", "config": {"model": "qwen3:8b"}})
            loop = asyncio.get_running_loop()
            with ThreadPoolExecutor(1) as pool:
                text = await loop.run_in_executor(pool, lambda: client.generate_text("Say hello"))
            return text, usage.summary()
        finally:
            telemetry.end(token)

    text, summary = asyncio.run(handler())
    assert text == "hi"
    assert summary == {"model": "qwen3:8b", "inputTokens": 12, "outputTokens": 30, "calls": 1}


@patch("requests.post")
def test_client_outside_a_job_does_not_fail(mock_post):
    mock_post.return_value = _ollama_response()
    client = CapabilityClient({"providerType": "ollama_local", "config": {}})
    assert client.generate_text("Say hello") == "hi"


def test_attach_usage_adds_metrics_without_overriding():
    summary = {"model": "m", "inputTokens": 1, "outputTokens": 2, "calls": 1}
    env = {"status": "completed", "artifacts": [], "metrics": {"durationSec": 3}}
    assert attach_usage(env, summary)["metrics"] == {"durationSec": 3, "usage": summary}
    own = {"status": "completed", "artifacts": [], "metrics": {"usage": {"model": "own"}}}
    assert attach_usage(own, summary)["metrics"]["usage"] == {"model": "own"}
    assert attach_usage(env, None) is env
    assert attach_usage("not a dict", summary) == "not a dict"
