import { describe, expect, it } from "vitest";
import { describeCron } from "../cron";

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
