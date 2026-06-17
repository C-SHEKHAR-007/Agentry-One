"""Thin wrapper standardizing progress reporting for agent step handlers."""

from __future__ import annotations

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

    async def report_progress(self, percent: int, message: str) -> None:
        await self._raw.updateProgress({"percent": percent, "message": message})
