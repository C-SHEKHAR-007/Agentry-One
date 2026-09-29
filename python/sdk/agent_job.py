"""Thin wrapper standardizing progress reporting for agent step handlers."""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request
from typing import Any


class AgentJob:
    def __init__(self, raw_job: Any):
        self._raw = raw_job
        data = raw_job.data
        self.job_id: str = data["jobId"]
        self.workflow_id: str = data["workflowId"]
        self.step_key: str = data["stepKey"]
        self.agent_id: str = data["agentId"]
        self.agent_version: str = data["agentVersion"]
        self.params: dict = data.get("params") or {}
        self.input_artifacts: list = data.get("inputArtifactRefs") or []
        self.provider_context: dict | None = data.get("providerContext")
        self.social_auth: dict | None = data.get("socialAuth")
        self.step_manifest: dict | None = data.get("stepManifest")
        self.agent_manifest: dict | None = data.get("agentManifest")

    @property
    def needs_secrets(self) -> bool:
        return bool(
            (self.provider_context and self.provider_context.get("hasApiKey") and not self.provider_context.get("apiKey"))
            or (self.social_auth and self.social_auth.get("hasAccessToken") and not self.social_auth.get("accessToken"))
        )

    async def load_secrets(self) -> None:
        """Fetches this job's decrypted credentials from the API. They are
        never placed in the Redis payload (see apps/api enqueueStepJob), so
        handlers read them from provider_context["apiKey"] /
        social_auth["accessToken"] only after this runs -- the runner calls it
        before dispatching a handler."""
        if not self.needs_secrets:
            return
        secrets = await asyncio.get_running_loop().run_in_executor(None, _fetch_job_secrets, self.job_id)
        if self.provider_context is not None:
            self.provider_context["apiKey"] = secrets.get("apiKey")
        if self.social_auth is not None:
            self.social_auth["accessToken"] = secrets.get("socialAccessToken")
            if self.social_auth.get("hasAccessToken") and not self.social_auth["accessToken"]:
                raise RuntimeError("the social account for this job is no longer available (disconnected or expired)")

    async def report_progress(self, percent: int, message: str) -> None:
        await self._raw.updateProgress({"percent": percent, "message": message})

    async def log(self, message: str, level: str = "info") -> None:
        """Adds a line to this attempt's log on the run page (levels: debug,
        info, warn, error). Progress messages are logged automatically."""
        await self._raw.updateProgress({"log": {"level": level, "message": str(message)}})

    async def report_usage(self, usage: dict) -> None:
        await self._raw.updateProgress({"usage": usage})


def _fetch_job_secrets(job_id: str) -> dict:
    api_url = os.environ.get("AGENTRY_API_URL", "http://localhost:4000").rstrip("/")
    api_key = os.environ.get("AGENTRY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "AGENTRY_API_KEY must be set in the worker environment: job credentials are fetched from the API at run time"
        )
    req = urllib.request.Request(
        f"{api_url}/internal/jobs/{job_id}/secrets",
        headers={"X-API-Key": api_key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Deliberately excludes the response body and request headers.
        raise RuntimeError(f"could not fetch job credentials from the API (HTTP {exc.code})") from None
    except urllib.error.URLError as exc:
        raise RuntimeError(f"could not reach the API at {api_url} to fetch job credentials: {exc.reason}") from None
