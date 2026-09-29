import { describe, expect, it } from "vitest";
import { classifyProgress, completionLine, formatMs, parseUsage } from "../src/queue/telemetry.js";
import { withRunUsage, type RunDetail } from "../src/modules/templates/runUsage.js";

describe("parseUsage", () => {
  it("keeps valid fields and rounds token counts", () => {
    expect(parseUsage({ model: " qwen3:8b ", inputTokens: 120.4, outputTokens: 30 })).toEqual({
      model: "qwen3:8b",
      inputTokens: 120,
      outputTokens: 30,
    });
  });

  it("drops malformed fields instead of failing", () => {
    expect(parseUsage({ model: 42, inputTokens: -3, outputTokens: "many" })).toBeNull();
    expect(parseUsage({ model: "sd-turbo", inputTokens: Number.NaN })).toEqual({
      model: "sd-turbo",
      inputTokens: null,
      outputTokens: null,
    });
    expect(parseUsage(null)).toBeNull();
    expect(parseUsage("tokens")).toBeNull();
  });
});

describe("classifyProgress", () => {
  it("recognises progress ticks", () => {
    expect(classifyProgress({ percent: 40, message: "Encoding" })).toEqual({ kind: "progress", percent: 40, message: "Encoding" });
    expect(classifyProgress(55)).toEqual({ kind: "progress", percent: undefined, message: undefined });
  });

  it("recognises log lines and normalises unknown levels", () => {
    expect(classifyProgress({ log: { level: "warn", message: "retrying fetch" } })).toEqual({
      kind: "log",
      level: "warn",
      message: "retrying fetch",
    });
    expect(classifyProgress({ log: { level: "loud", message: 7 } })).toEqual({ kind: "log", level: "info", message: "7" });
  });

  it("recognises usage reports, falling back to progress when empty", () => {
    expect(classifyProgress({ usage: { model: "gpt-4o", inputTokens: 5, outputTokens: 9 } })).toEqual({
      kind: "usage",
      usage: { model: "gpt-4o", inputTokens: 5, outputTokens: 9 },
    });
    expect(classifyProgress({ usage: {} }).kind).toBe("progress");
  });
});

describe("completionLine", () => {
  it("summarises duration, model, tokens and artifacts", () => {
    expect(completionLine(2400, { model: "qwen3:8b", inputTokens: 1000, outputTokens: 284 }, 1)).toBe(
      "Completed in 2.4s · on qwen3:8b · 1,284 tokens · 1 artifact",
    );
    expect(completionLine(null, null, 0)).toBe("Completed · 0 artifacts");
  });

  it("formats durations", () => {
    expect(formatMs(850)).toBe("850ms");
    expect(formatMs(61_500)).toBe("1m 2s");
  });
});

const t = (s: number) => new Date(Date.UTC(2026, 8, 29, 10, 0, s));

function runStep(id: string, status: string, stepOrder: number, runs: Array<Record<string, unknown>>) {
  return {
    id,
    status,
    workflowId: runs.length ? `wf-${id}` : null,
    createdAt: t(0),
    updatedAt: t(0),
    templateRunId: "run",
    templateStepId: `ts-${id}`,
    templateStep: { id: `ts-${id}`, stepOrder, agentId: "echo-agent" },
    workflow: runs.length
      ? {
          id: `wf-${id}`,
          status,
          agentId: "echo-agent",
          createdAt: t(0),
          agent: { id: "echo-agent", name: "Echo Agent" },
          steps: [{ job: { providerType: "ollama", providerModel: "qwen3:8b", runs } }],
        }
      : null,
  };
}

describe("withRunUsage", () => {
  const attempt = (n: number, status: string, start: number, end: number | null, extra: Record<string, unknown> = {}) => ({
    attemptNumber: n,
    status,
    startedAt: t(start),
    finishedAt: end === null ? null : t(end),
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    progressPercent: null,
    progressMessage: null,
    error: null,
    ...extra,
  });

  it("sums attempts per step and totals a settled run", () => {
    const run = {
      id: "run",
      templateId: "tpl",
      status: "completed",
      runInputs: {},
      createdAt: t(0),
      updatedAt: t(0),
      template: { id: "tpl", name: "Pipeline", projectId: "p" },
      steps: [
        runStep("a", "completed", 0, [
          attempt(1, "failed", 1, 3, { error: { message: "boom" } }),
          attempt(2, "completed", 4, 9, { model: "qwen3:8b", inputTokens: 100, outputTokens: 40, costUsd: 0.01 }),
        ]),
        runStep("b", "completed", 1, [attempt(1, "completed", 10, 12, { inputTokens: 5, outputTokens: 5, costUsd: 0.02 })]),
      ],
    } as unknown as RunDetail;

    const out = withRunUsage(run);
    expect(out.steps[0].usage).toMatchObject({ attempts: 2, model: "qwen3:8b", inputTokens: 100, outputTokens: 40, durationMs: 8000 });
    // No reported model: fall back to the model the job was enqueued with.
    expect(out.steps[1].usage.model).toBe("qwen3:8b");
    expect(out.steps[0].workflow).toMatchObject({ agentName: "Echo Agent" });
    expect(out.totals).toEqual({ inputTokens: 105, outputTokens: 45, costUsd: 0.03, durationMs: 11000 });
  });

  it("leaves the total duration open while a step is still running", () => {
    const run = {
      id: "run",
      templateId: "tpl",
      status: "running",
      runInputs: {},
      createdAt: t(0),
      updatedAt: t(0),
      template: { id: "tpl", name: "Pipeline", projectId: "p" },
      steps: [runStep("a", "running", 0, [attempt(1, "running", 1, null, { progressPercent: 45 })]), runStep("b", "pending", 1, [])],
    } as unknown as RunDetail;

    const out = withRunUsage(run);
    expect(out.steps[0].usage).toMatchObject({ finishedAt: null, durationMs: null, progressPercent: 45 });
    expect(out.steps[1].usage.attempts).toBe(0);
    expect(out.totals.durationMs).toBeNull();
  });
});
