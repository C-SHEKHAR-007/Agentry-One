import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("artifacts: gallery, kind filter, preview", async ({ page }) => {
  const all: Array<{ id: string; kind: string }> = await (await page.request.get("/api/artifacts?limit=50")).json();
  await page.goto("/artifacts");
  await expect(page.getByRole("heading", { name: "Artifacts" })).toBeVisible();
  test.skip(all.length === 0, "no artifacts in this environment");

  // The kind options come from the artifacts on screen; pick whichever exists.
  const kind = page.locator("select").filter({ has: page.locator("option", { hasText: "All kinds" }) });
  const first = await kind.locator("option").nth(1).getAttribute("value");
  if (first) {
    const listed = page.waitForRequest((r) => r.url().includes("/api/artifacts") && r.url().includes(`kind=${first}`));
    await kind.selectOption(first);
    await listed;
    await kind.selectOption("");
  }

  // Opening an artifact shows its preview dialog.
  await page.locator("main button").filter({ hasText: /Text|Image|Audio|Video|Launch|E2E/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
