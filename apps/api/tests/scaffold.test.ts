import { describe, expect, it } from "vitest";
import {
  buildScaffoldFiles,
  validateScaffoldSpec,
  type ScaffoldSpec,
} from "../src/modules/agents/scaffold.js";

const validSpec: ScaffoldSpec = {
  id: "echo-agent",
  name: "Echo",
  description: "echoes input",
  fields: [
    { name: "message", type: "string", required: true },
    { name: "repeat", type: "integer", default: 1 },
  ],
};

describe("validateScaffoldSpec", () => {
  it("accepts a valid spec", () => {
    expect(validateScaffoldSpec(validSpec)).toEqual([]);
  });

  it("rejects bad slugs (traversal, uppercase, too short)", () => {
    for (const id of ["../evil", "Evil", "a", "has spaces", "-lead", "x".repeat(41)]) {
      expect(validateScaffoldSpec({ ...validSpec, id }).length, id).toBeGreaterThan(0);
    }
  });

  it("rejects empty fields, bad field names, and duplicates", () => {
    expect(validateScaffoldSpec({ ...validSpec, fields: [] })).not.toEqual([]);
    expect(
      validateScaffoldSpec({ ...validSpec, fields: [{ name: "1bad", type: "string" }] }),
    ).not.toEqual([]);
    expect(
      validateScaffoldSpec({
        ...validSpec,
        fields: [
          { name: "x", type: "string" },
          { name: "x", type: "number" },
        ],
      }),
    ).not.toEqual([]);
  });
});

describe("buildScaffoldFiles", () => {
  const files = buildScaffoldFiles(validSpec);

  it("produces the full file set", () => {
    expect(Object.keys(files).sort()).toEqual([
      "manifest.json",
      "requirements.txt",
      "schemas/run.input.json",
      "schemas/run.output.json",
      "worker.py",
    ]);
  });

  it("emits a valid manifest wired to the derived queue and module", () => {
    const manifest = JSON.parse(files["manifest.json"]);
    expect(manifest.id).toBe("echo-agent");
    expect(manifest.entrypoint).toEqual({
      type: "python-worker",
      module: "agents.echo-agent.worker",
      queueName: "agent.echo-agent",
    });
    expect(manifest.steps).toHaveLength(1);
    expect(manifest.steps[0].key).toBe("run");
    expect(manifest.steps[0].producesArtifactKinds).toEqual(["text"]);
    expect(manifest.steps[0].requiresCapability).toBeUndefined();
  });

  it("includes requiresCapability only when given", () => {
    const withCap = buildScaffoldFiles({ ...validSpec, capability: "text-generation" });
    expect(JSON.parse(withCap["manifest.json"]).steps[0].requiresCapability).toBe("text-generation");
  });

  it("maps fields to the input schema with required + defaults", () => {
    const schema = JSON.parse(files["schemas/run.input.json"]);
    expect(schema.required).toEqual(["message"]);
    expect(schema.properties.message).toEqual({ type: "string", title: "message" });
    expect(schema.properties.repeat).toEqual({ type: "integer", title: "repeat", default: 1 });
  });

  it("worker stub registers the run step on the manifest queue", () => {
    expect(files["worker.py"]).toContain('run_agent({"run": run}, queue_name="agent.echo-agent")');
    expect(files["worker.py"]).toContain("python.sdk.runner");
  });
});
