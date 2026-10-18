import { describe, expect, it } from "vitest";
import { buildCron, describeCron, nextRuns, parseCronSpec, type CronSpec } from "../cron";

describe("describeCron", () => {
  it.each([
    ["0 3 * * *", "Daily at 03:00"],
    ["30 9 * * 1-5", "Weekdays at 09:30"],
    ["0 9 * * 2", "Tue at 09:00"],
    ["0 9 * * 1,3,5", "Mon, Wed, Fri at 09:00"],
    ["0 8 1 * *", "Monthly on day 1 at 08:00"],
    ["*/15 * * * *", "Every 15 min"],
    ["0 * * * *", "Hourly"],
    ["15 * * * *", "Hourly at :15"],
    ["0 */6 * * *", "Every 6 h"],
  ])("%s -> %s", (expr, text) => {
    expect(describeCron(expr)).toBe(text);
  });

  it("falls back to the raw expression for unusual shapes", () => {
    expect(describeCron("0 9 * 1 *")).toBe("0 9 * 1 *");
    expect(describeCron("not a cron")).toBe("not a cron");
  });
});

describe("buildCron / parseCronSpec", () => {
  const cases: Array<[CronSpec, string]> = [
    [{ kind: "daily", time: "09:30" }, "30 9 * * *"],
    [{ kind: "weekdays", time: "08:00" }, "0 8 * * 1-5"],
    [{ kind: "weekly", days: [5, 1, 1], time: "17:05" }, "5 17 * * 1,5"],
    [{ kind: "monthly", day: 1, time: "06:00" }, "0 6 1 * *"],
    [{ kind: "hourly", minute: 15 }, "15 * * * *"],
    [{ kind: "everyMinutes", every: 10 }, "*/10 * * * *"],
  ];
  it.each(cases)("%o <-> %s", (spec, expr) => {
    expect(buildCron(spec)).toBe(expr);
    expect(buildCron(parseCronSpec(expr))).toBe(expr);
  });

  it("keeps the builder's limits: at least one weekday, months up to day 28", () => {
    expect(buildCron({ kind: "weekly", days: [], time: "09:00" })).toBe("0 9 * * 1");
    expect(buildCron({ kind: "monthly", day: 31, time: "09:00" })).toBe("0 9 28 * *");
  });

  it("treats anything the builder can't show as custom", () => {
    expect(parseCronSpec("0 9 * 1 *")).toEqual({ kind: "custom", expr: "0 9 * 1 *" });
    expect(parseCronSpec("0 9 31 * *").kind).toBe("custom");
    expect(parseCronSpec("garbage").kind).toBe("custom");
  });
});

describe("nextRuns", () => {
  // Sunday 18 Oct 2026, 10:00 local time.
  const from = new Date(2026, 9, 18, 10, 0);
  const fmt = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

  it("lists the next runs of the common shapes", () => {
    expect(nextRuns("0 9 * * 2", from).map(fmt)).toEqual(["2026-10-20 9:00", "2026-10-27 9:00", "2026-11-3 9:00"]);
    expect(nextRuns("30 9 * * *", from, 2).map(fmt)).toEqual(["2026-10-19 9:30", "2026-10-20 9:30"]);
    expect(nextRuns("0 8 * * 1-5", from, 2).map(fmt)).toEqual(["2026-10-19 8:00", "2026-10-20 8:00"]);
    expect(nextRuns("*/15 * * * *", from, 2).map(fmt)).toEqual(["2026-10-18 10:15", "2026-10-18 10:30"]);
    expect(nextRuns("0 6 1 * *", from, 2).map(fmt)).toEqual(["2026-11-1 6:00", "2026-12-1 6:00"]);
  });

  it("starts after `from`, never at it", () => {
    expect(nextRuns("0 10 * * *", from, 1).map(fmt)).toEqual(["2026-10-19 10:00"]);
  });

  it("matches either day field when both are restricted, as cron does", () => {
    // The 20th, or any Friday.
    expect(nextRuns("0 9 20 * 5", from, 3).map(fmt)).toEqual(["2026-10-20 9:00", "2026-10-23 9:00", "2026-10-30 9:00"]);
  });

  it("returns nothing for expressions it can't read", () => {
    expect(nextRuns("every tuesday", from)).toEqual([]);
    expect(nextRuns("61 * * * *", from)).toEqual([]);
    expect(nextRuns("0 9 30 2 *", from)).toEqual([]);
  });
});
