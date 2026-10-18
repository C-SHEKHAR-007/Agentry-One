import { describe, expect, it } from "vitest";
import { ACTIVITY_DAYS, emptyActivity, summarizeActivity } from "../src/modules/projects/activity.js";

const now = new Date("2026-10-18T15:30:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("summarizeActivity", () => {
  it("counts runs per day, oldest first, ending today", () => {
    const m = summarizeActivity(
      [
        { projectId: "p1", day: day("2026-10-18"), status: "completed", n: 3 },
        { projectId: "p1", day: day("2026-10-18"), status: "failed", n: 1 },
        { projectId: "p1", day: day("2026-09-19"), status: "running", n: 2 },
      ],
      now,
    );
    const a = m.get("p1")!;
    expect(a.daily).toHaveLength(ACTIVITY_DAYS);
    expect(a.daily[ACTIVITY_DAYS - 1]).toBe(4);
    expect(a.daily[0]).toBe(2);
    expect(a.runs30d).toBe(6);
    expect(a.completed30d).toBe(3);
    expect(a.failed30d).toBe(1);
    expect(a.successRate).toBe(0.75);
  });

  it("ignores days outside the window and has no rate until a run settles", () => {
    const m = summarizeActivity(
      [
        { projectId: "p2", day: day("2026-09-18"), status: "completed", n: 9 },
        { projectId: "p2", day: day("2026-10-17"), status: "running", n: 1 },
      ],
      now,
    );
    expect(m.get("p2")).toMatchObject({ runs30d: 1, completed30d: 0, successRate: null });
  });

  it("keeps projects apart and gives an empty summary shape", () => {
    const m = summarizeActivity(
      [
        { projectId: "a", day: day("2026-10-01"), status: "completed", n: 1 },
        { projectId: "b", day: day("2026-10-01"), status: "failed", n: 1 },
      ],
      now,
    );
    expect(m.get("a")!.successRate).toBe(1);
    expect(m.get("b")!.successRate).toBe(0);
    expect(emptyActivity()).toEqual({ runs30d: 0, completed30d: 0, failed30d: 0, successRate: null, daily: Array(30).fill(0) });
  });
});
