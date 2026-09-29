import { describe, expect, it } from "vitest";
import { formatDuration, formatTokens, formatUsd, runCode } from "../format";
import { statusStyle } from "../status";
import { chainColumns } from "../../components/common/StepChain";
import type { RunSummaryStep } from "../../models";

describe("format helpers", () => {
  it("formats durations up to days", () => {
    expect(formatDuration(850)).toBe("850ms");
    expect(formatDuration(18_400)).toBe("18.4s");
    expect(formatDuration(125_000)).toBe("2m 5s");
    expect(formatDuration(6_955_000)).toBe("1h 55m");
    expect(formatDuration(90_000_000)).toBe("1d 1h");
    expect(formatDuration(null)).toBe("—");
  });

  it("formats token counts", () => {
    expect(formatTokens(1284)).toBe("1,284");
    expect(formatTokens(48_210, { compact: true })).toBe("48.2k");
    expect(formatTokens(0)).toBe("—");
    expect(formatTokens(0, { zero: true })).toBe("0");
  });

  it("keeps sub-cent costs readable", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(0.084)).toBe("$0.084");
    expect(formatUsd(0.0400)).toBe("$0.04");
    expect(formatUsd(2.237)).toBe("$2.24");
    expect(formatUsd(null)).toBe("—");
  });

  it("derives a short run code", () => {
    expect(runCode("8f92a1c0-1111-2222-3333-444455556666")).toBe("RUN_8F92A1");
  });
});

describe("statusStyle", () => {
  it("maps known statuses to one language", () => {
    expect(statusStyle("running")).toMatchObject({ label: "Running", tone: "primary", live: true });
    expect(statusStyle("failed")).toMatchObject({ label: "Failed", tone: "destructive" });
    expect(statusStyle("awaiting_review")).toMatchObject({ label: "Needs review", tone: "warning" });
  });

  it("humanises unknown statuses", () => {
    expect(statusStyle("partially_done")).toMatchObject({ label: "Partially done", tone: "muted" });
  });
});

const step = (stepOrder: number, dependsOn: number[] = []): RunSummaryStep => ({
  id: `s${stepOrder}`,
  status: "pending",
  workflowId: null,
  stepOrder,
  agentId: "a",
  agentName: `Agent ${stepOrder}`,
  dependsOn,
});

describe("chainColumns", () => {
  it("puts parallel branches in the same column", () => {
    const cols = chainColumns([step(0), step(1), step(2, [0]), step(3, [1, 2])]);
    expect(cols.map((c) => c.map((s) => s.stepOrder))).toEqual([[0, 1], [2], [3]]);
  });

  it("tolerates references to missing steps", () => {
    const cols = chainColumns([step(0, [7]), step(1, [0])]);
    expect(cols.map((c) => c.map((s) => s.stepOrder))).toEqual([[0], [1]]);
  });
});
