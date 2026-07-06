// Pure file-content generator for Agent Studio scaffolds. No IO here -- the
// route writes the returned map to disk (tested without a filesystem, same
// pattern as templates/validation.ts).

export interface ScaffoldField {
  name: string;
  type: "string" | "number" | "integer" | "boolean";
  title?: string;
  required?: boolean;
  default?: unknown;
}

export interface ScaffoldSpec {
  id: string;
  name: string;
  description: string;
  capability?: string;
  fields: ScaffoldField[];
}

export const AGENT_ID_RE = /^[a-z][a-z0-9-]{1,39}$/;

const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

export function validateScaffoldSpec(spec: ScaffoldSpec): string[] {
  const errors: string[] = [];
  if (!AGENT_ID_RE.test(spec.id)) {
    errors.push("id must be a slug: lowercase letters, digits, hyphens, 2-40 chars, starting with a letter");
  }
  if (!spec.name?.trim()) errors.push("name is required");
  if (!spec.description?.trim()) errors.push("description is required");
  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    errors.push("at least one input field is required");
  } else {
    for (const f of spec.fields) {
      if (!FIELD_NAME_RE.test(f.name)) errors.push(`invalid field name '${f.name}'`);
      if (!["string", "number", "integer", "boolean"].includes(f.type)) {
        errors.push(`invalid type for field '${f.name}'`);
      }
    }
    const names = new Set(spec.fields.map((f) => f.name));
    if (names.size !== spec.fields.length) errors.push("field names must be unique");
  }
  return errors;
}

/** The python module path/queue name derive from the id; hyphens are invalid
 * in python module names so the worker dir uses the id verbatim (worker is
 * run by path, not imported as a module). */
export function buildScaffoldFiles(spec: ScaffoldSpec): Record<string, string> {
  const queueName = `agent.${spec.id}`;

  const properties: Record<string, unknown> = {};
  for (const f of spec.fields) {
    const prop: Record<string, unknown> = { type: f.type, title: f.title || f.name };
    if (f.default !== undefined && f.default !== "") prop.default = f.default;
    properties[f.name] = prop;
  }
  const required = spec.fields.filter((f) => f.required).map((f) => f.name);

  const manifest = {
    id: spec.id,
    name: spec.name,
    version: "0.1.0",
    description: spec.description,
    entrypoint: { type: "python-worker", module: `agents.${spec.id}.worker`, queueName },
    steps: [
      {
        key: "run",
        ...(spec.capability ? { requiresCapability: spec.capability } : {}),
        inputSchema: { $ref: "./schemas/run.input.json" },
        outputSchema: { $ref: "./schemas/run.output.json" },
        humanGate: false,
        producesArtifactKinds: ["text"],
      },
    ],
    resources: { cpu: 1, memoryMb: 512, gpu: false },
    concurrency: 1,
    timeoutSec: 120,
    attempts: 1,
  };

  const inputSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    ...(required.length ? { required } : {}),
    properties,
  };

  const outputSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      artifacts: { type: "array" },
    },
  };

  const worker = `"""${spec.name} worker (scaffolded by Agent Studio).

This stub echoes its input params into a text artifact so the end-to-end
pipeline (queue -> worker -> artifact -> UI) works immediately. Replace the
body of run() with your real logic.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root, for python.sdk imports

from python.sdk.agent_job import AgentJob
from python.sdk.runner import run_agent

ARTIFACTS_DIR = Path(os.environ.get("ARTIFACTS_DIR", str(Path(__file__).resolve().parents[2] / "artifacts")))


async def run(job: AgentJob) -> dict:
    await job.report_progress(10, "Working...")

    # TODO: replace with real logic. job.params holds the validated input;
    # job.provider_context is set when the step declares requiresCapability.
    output_text = json.dumps(job.params, indent=2)

    job_dir = ARTIFACTS_DIR / job.workflow_id
    job_dir.mkdir(parents=True, exist_ok=True)
    out_path = job_dir / f"{uuid.uuid4()}.txt"
    out_path.write_text(output_text)

    await job.report_progress(100, "Done.")
    return {
        "status": "completed",
        "artifacts": [
            {"kind": "text", "path": str(out_path), "mimeType": "text/plain", "metadata": {}}
        ],
        "error": None,
    }


if __name__ == "__main__":
    run_agent({"run": run}, queue_name="${queueName}")
`;

  const dockerfile = `FROM python:3.12-slim

WORKDIR /app

COPY agents/${spec.id}/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# The worker imports python.sdk from the repo root, so the build context is
# the repo root (see docker-compose.yml) and both trees are copied in.
COPY python ./python
COPY agents/${spec.id} ./agents/${spec.id}

ENV ARTIFACTS_DIR=/artifacts

CMD ["python", "agents/${spec.id}/worker.py"]
`;

  return {
    "manifest.json": JSON.stringify(manifest, null, 2) + "\n",
    "schemas/run.input.json": JSON.stringify(inputSchema, null, 2) + "\n",
    "schemas/run.output.json": JSON.stringify(outputSchema, null, 2) + "\n",
    "worker.py": worker,
    "requirements.txt": "bullmq\n",
  };
}
