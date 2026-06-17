import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface AgentStepManifest {
  key: string;
  requiresCapability?: string;
  inputSchema: unknown;
  outputSchema: unknown;
  humanGate: boolean;
  producesArtifactKinds: string[];
}

export interface AgentManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: { type: string; module: string; queueName: string };
  steps: AgentStepManifest[];
  resources: { cpu: number; memoryMb: number; gpu: boolean };
  concurrency: number;
  timeoutSec: number;
  attempts?: number;
  backoff?: { type: string; delayMs: number };
}

export const AGENTS_DIR = process.env.AGENTS_DIR ?? path.resolve(process.cwd(), "../../agents");

/** Resolves a manifest step's `{"$ref": "./schemas/x.json"}` input/output
 * schema fields into the actual schema object, relative to the agent's own
 * directory, so the stored manifest snapshot is self-contained. */
async function resolveSchemaRef(agentDir: string, value: unknown): Promise<unknown> {
  if (
    value &&
    typeof value === "object" &&
    "$ref" in value &&
    typeof (value as { $ref: unknown }).$ref === "string"
  ) {
    const refPath = path.resolve(agentDir, (value as { $ref: string }).$ref);
    const raw = await readFile(refPath, "utf-8");
    return JSON.parse(raw);
  }
  return value;
}

/** Scans agents/<id>/manifest.json for every subdirectory of AGENTS_DIR,
 * resolving schema $refs, and returns the fully-resolved manifests found.
 * Silently skips directories without a manifest.json (e.g. non-agent dirs). */
export async function scanAgentManifests(): Promise<AgentManifest[]> {
  let entries: string[];
  try {
    entries = await readdir(AGENTS_DIR);
  } catch {
    return [];
  }

  const manifests: AgentManifest[] = [];

  for (const entry of entries) {
    const agentDir = path.join(AGENTS_DIR, entry);
    const manifestPath = path.join(agentDir, "manifest.json");
    let raw: string;
    try {
      raw = await readFile(manifestPath, "utf-8");
    } catch {
      continue; // not an agent directory
    }

    const manifest = JSON.parse(raw) as AgentManifest;
    manifest.steps = await Promise.all(
      manifest.steps.map(async (step) => ({
        ...step,
        inputSchema: await resolveSchemaRef(agentDir, step.inputSchema),
        outputSchema: await resolveSchemaRef(agentDir, step.outputSchema),
      })),
    );
    manifests.push(manifest);
  }

  return manifests;
}
