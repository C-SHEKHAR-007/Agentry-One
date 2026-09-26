import asyncio
import io
import json
from types import SimpleNamespace

import pytest

from sdk import agent_job
from sdk.agent_job import AgentJob


def _job(provider_context=None, social_auth=None):
    raw = SimpleNamespace(
        data={
            "jobId": "job-1",
            "workflowId": "wf-1",
            "stepKey": "run",
            "agentId": "a",
            "agentVersion": "1",
            "providerContext": provider_context,
            "socialAuth": social_auth,
        }
    )
    return AgentJob(raw)


def test_no_fetch_when_no_secrets_needed(monkeypatch):
    monkeypatch.setattr(agent_job, "_fetch_job_secrets", lambda _id: pytest.fail("should not fetch"))
    job = _job(provider_context={"providerType": "ollama", "apiKey": None, "hasApiKey": False})
    asyncio.run(job.load_secrets())


def test_secrets_are_fetched_and_merged(monkeypatch):
    monkeypatch.setattr(
        agent_job, "_fetch_job_secrets", lambda job_id: {"apiKey": f"key-for-{job_id}", "socialAccessToken": "tok"}
    )
    job = _job(
        provider_context={"providerType": "openai", "apiKey": None, "hasApiKey": True},
        social_auth={"platform": "x", "hasAccessToken": True},
    )
    asyncio.run(job.load_secrets())
    assert job.provider_context["apiKey"] == "key-for-job-1"
    assert job.social_auth["accessToken"] == "tok"


def test_missing_social_token_fails_loudly(monkeypatch):
    monkeypatch.setattr(agent_job, "_fetch_job_secrets", lambda _id: {"apiKey": None, "socialAccessToken": None})
    job = _job(social_auth={"platform": "x", "hasAccessToken": True})
    with pytest.raises(RuntimeError, match="no longer available"):
        asyncio.run(job.load_secrets())


def test_fetch_requires_api_key(monkeypatch):
    monkeypatch.delenv("AGENTRY_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="AGENTRY_API_KEY"):
        agent_job._fetch_job_secrets("job-1")


def test_fetch_sends_key_in_header_not_url(monkeypatch):
    seen = {}

    class Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout):
        seen["url"] = req.full_url
        seen["key"] = req.get_header("X-api-key")
        return Resp(json.dumps({"apiKey": "k", "socialAccessToken": None}).encode())

    monkeypatch.setenv("AGENTRY_API_KEY", "secret-key")
    monkeypatch.setenv("AGENTRY_API_URL", "http://api.internal:4000/")
    monkeypatch.setattr(agent_job.urllib.request, "urlopen", fake_urlopen)
    assert agent_job._fetch_job_secrets("job-9") == {"apiKey": "k", "socialAccessToken": None}
    assert seen["url"] == "http://api.internal:4000/internal/jobs/job-9/secrets"
    assert "secret-key" not in seen["url"]
    assert seen["key"] == "secret-key"
