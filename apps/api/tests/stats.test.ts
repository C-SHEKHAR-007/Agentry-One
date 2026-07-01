import { describe, expect, it } from "vitest";
import {
  buildAgentStats,
  buildDailySeries,
  computeCosts,
  computeRunStats,
  estimateCostSavedUsd,
  fillDaySeries,
} from "../src/modules/stats/service.js";

const at = (iso: string) => new Date(iso);

describe("computeRunStats", () => {
  it("returns nulls when there are no settled runs", () => {
    expect(computeRunStats([])).toEqual({ successRate: null, avgDurationMs: null });
    expect(
      computeRunStats([{ status: "running", startedAt: at("2026-01-01T00:00:00Z"), finishedAt: null }]),
    ).toEqual({ successRate: null, avgDurationMs: null });
  });

  it("computes success rate over settled runs only", () => {
    const runs = [
      { status: "completed", startedAt: at("2026-01-01T00:00:00Z"), finishedAt: at("2026-01-01T00:00:10Z") },
      { status: "failed", startedAt: at("2026-01-01T00:00:00Z"), finishedAt: at("2026-01-01T00:00:05Z") },
      { status: "running", startedAt: at("2026-01-01T00:00:00Z"), finishedAt: null },
    ];
    const stats = computeRunStats(runs);
    expect(stats.successRate).toBeCloseTo(0.5);
    expect(stats.avgDurationMs).toBe(10_000);
  });

  it("excludes runs with a missing startedAt from the duration average", () => {
    const runs = [
      { status: "completed", startedAt: null, finishedAt: at("2026-01-01T00:00:10Z") },
      { status: "completed", startedAt: at("2026-01-01T00:00:00Z"), finishedAt: at("2026-01-01T00:00:20Z") },
    ];
    expect(computeRunStats(runs).avgDurationMs).toBe(20_000);
  });

  it("returns null avg duration when no completed run has both timestamps", () => {
    const runs = [{ status: "failed", startedAt: null, finishedAt: at("2026-01-01T00:00:05Z") }];
    const stats = computeRunStats(runs);
    expect(stats.successRate).toBe(0);
    expect(stats.avgDurationMs).toBeNull();
  });
});

describe("buildAgentStats", () => {
  it("rolls up status counts, lastRunAt, and share per agent", () => {
    const stats = buildAgentStats(
      [
        { agentId: "sketch", status: "completed", count: 3, lastRunAt: at("2026-01-02T00:00:00Z") },
        { agentId: "sketch", status: "failed", count: 1, lastRunAt: at("2026-01-03T00:00:00Z") },
        { agentId: "video", status: "completed", count: 1, lastRunAt: at("2026-01-01T00:00:00Z") },
      ],
      [],
    );
    expect(stats).toHaveLength(2);
    const sketch = stats[0];
    expect(sketch.agentId).toBe("sketch"); // most runs first
    expect(sketch.runs).toBe(4);
    expect(sketch.completed).toBe(3);
    expect(sketch.failed).toBe(1);
    expect(sketch.successRate).toBeCloseTo(0.75); // derived from counts without samples
    expect(sketch.lastRunAt).toEqual(at("2026-01-03T00:00:00Z"));
    expect(sketch.share).toBeCloseTo(0.8);
  });

  it("uses run samples for duration when available", () => {
    const stats = buildAgentStats(
      [{ agentId: "sketch", status: "completed", count: 1, lastRunAt: null }],
      [
        {
          agentId: "sketch",
          status: "completed",
          startedAt: at("2026-01-01T00:00:00Z"),
          finishedAt: at("2026-01-01T00:00:08Z"),
        },
      ],
    );
    expect(stats[0].avgDurationMs).toBe(8_000);
    expect(stats[0].successRate).toBe(1);
  });

  it("returns an empty list for no data", () => {
    expect(buildAgentStats([], [])).toEqual([]);
  });
});

describe("fillDaySeries", () => {
  it("fills missing days with zero, oldest first", () => {
    const today = at("2026-07-07T15:30:00Z");
    const series = fillDaySeries([{ date: "2026-07-06", count: 3 }], 3, today);
    expect(series).toHaveLength(3);
    expect(series[0].count).toBe(0);
    expect(series[1]).toEqual({ date: "2026-07-06", count: 3 });
    expect(series[2].date).toBe("2026-07-07");
  });
});

describe("buildDailySeries", () => {
  it("fills gaps and merges completed/failed rows per day", () => {
    const today = at("2026-07-07T12:00:00Z");
    const series = buildDailySeries(
      [
        { day: "2026-07-06", status: "completed", count: 4, avgMs: 18500.4 },
        { day: "2026-07-06", status: "failed", count: 1, avgMs: null },
      ],
      3,
      today,
    );
    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ date: "2026-07-05", completed: 0, failed: 0, avgDurationMs: null });
    expect(series[1]).toEqual({ date: "2026-07-06", completed: 4, failed: 1, avgDurationMs: 18500 });
    expect(series[2].date).toBe("2026-07-07");
  });
});

describe("computeCosts", () => {
  const pricing = {
    "pricing.sd_turbo_local": { perJobUsd: 0 },
    "pricing.stability_ai": { perJobUsd: 0.04 },
  };

  it("returns zeros for no rows", () => {
    const c = computeCosts([], pricing, 0.04);
    expect(c).toEqual({ totalUsd: 0, savedUsd: 0, unattributedJobs: 0, perProvider: [], perDay: [] });
  });

  it("prices paid providers and credits savings for zero-cost providers", () => {
    const c = computeCosts(
      [
        { day: "2026-07-01", providerType: "sd_turbo_local", jobs: 10 },
        { day: "2026-07-01", providerType: "stability_ai", jobs: 5 },
        { day: "2026-07-02", providerType: "sd_turbo_local", jobs: 2 },
      ],
      pricing,
      0.04,
    );
    expect(c.totalUsd).toBeCloseTo(0.2); // 5 x 0.04
    expect(c.savedUsd).toBeCloseTo(0.48); // 12 x 0.04
    expect(c.perProvider).toEqual([
      { providerType: "sd_turbo_local", jobs: 12, usd: 0 },
      { providerType: "stability_ai", jobs: 5, usd: 0.2 },
    ]);
    expect(c.perDay).toHaveLength(2);
    expect(c.perDay[0]).toEqual({ date: "2026-07-01", usd: 0.2, savedUsd: 0.4, jobs: 15 });
  });

  it("counts unattributed jobs separately and never prices them", () => {
    const c = computeCosts([{ day: "2026-07-01", providerType: null, jobs: 7 }], pricing, 0.04);
    expect(c.unattributedJobs).toBe(7);
    expect(c.totalUsd).toBe(0);
    expect(c.savedUsd).toBe(0);
    expect(c.perDay[0].jobs).toBe(7);
  });

  it("treats providers missing from pricing as zero-cost (earns savings)", () => {
    const c = computeCosts([{ day: "2026-07-01", providerType: "mystery", jobs: 3 }], pricing, 0.1);
    expect(c.totalUsd).toBe(0);
    expect(c.savedUsd).toBeCloseTo(0.3);
  });
});

describe("estimateCostSavedUsd", () => {
  it("multiplies completed jobs by the per-image price, rounded to cents", () => {
    expect(estimateCostSavedUsd(0)).toBe(0);
    expect(estimateCostSavedUsd(154)).toBeCloseTo(6.16);
  });
});
