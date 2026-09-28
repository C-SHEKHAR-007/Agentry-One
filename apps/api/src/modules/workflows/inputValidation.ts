import { Ajv, type ValidateFunction } from "ajv";
import type { AgentStepManifest } from "../agents/manifestScanner.js";

const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true, coerceTypes: true });
const cache = new Map<string, ValidateFunction>();

/** Validates (and fills defaults into) a step's input against the manifest's
 * JSON Schema. Returns a readable error string, or null when valid or when
 * the step declares no usable schema. */
export function validateStepInput(agentId: string, step: AgentStepManifest, input: unknown): string | null {
  const schema = step.inputSchema;
  if (!schema || typeof schema !== "object") return null;
  const key = `${agentId}:${step.key}:${JSON.stringify(schema)}`;
  let validate = cache.get(key);
  if (!validate) {
    try {
      const { $schema: _ignored, ...rest } = schema as Record<string, unknown>;
      validate = ajv.compile(rest);
    } catch {
      return null; // an unparseable manifest schema shouldn't block every run
    }
    cache.set(key, validate);
  }
  if (validate(input ?? {})) return null;
  return (validate.errors ?? [])
    .map((e) => `${e.instancePath || "input"} ${e.message ?? "is invalid"}`.trim())
    .join("; ");
}
