import { expect, test } from "@playwright/test";

test("analytics: KPIs, charts and range switch", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Job outcomes per day")).toBeVisible();
  await expect(page.getByText("Agent breakdown")).toBeVisible();
  const range = page.locator("select").first();
  const seriesCall = page.waitForRequest((r) => r.url().includes("/api/stats/series"));
  await range.selectOption({ index: 0 });
  await range.selectOption({ index: 1 });
  await seriesCall;
});

test("cost monitor: breakdown and pricing save", async ({ page }) => {
  await page.goto("/costs");
  await expect(page.getByRole("heading", { name: "Cost Monitor" })).toBeVisible();
  await expect(page.getByText("Spend & savings per day")).toBeVisible();
  // Re-save the first price unchanged (no side effects) and expect the confirmation.
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText(/ updated$/).first()).toBeVisible();
});
