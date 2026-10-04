import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("artifacts: gallery, kind filter, preview", async ({ page }) => {
  const all: Array<{ id: string; kind: string }> = await (await page.request.get("/api/artifacts?limit=50")).json();
  await page.goto("/artifacts");
  await expect(page.getByRole("heading", { name: "Artifacts" })).toBeVisible();
  test.skip(all.length === 0, "no artifacts in this environment");

  // The kind options list every kind there is; pick whichever comes first.
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

test("artifacts: text previews, search, and stepping through the viewer", async ({ page }) => {
  const first: { items: Array<{ id: string; kind: string; projectName: string; textPreview?: string | null }> } = await (
    await page.request.get("/api/artifacts?paged=1&limit=48")
  ).json();
  test.skip(first.items.length < 2, "needs at least two artifacts");

  // The kind list covers every kind, not just the loaded ones.
  const kinds: string[] = await (await page.request.get("/api/artifacts/kinds")).json();
  expect(kinds.length).toBeGreaterThan(0);
  expect(new Set(first.items.map((a) => a.kind)).size).toBeLessThanOrEqual(kinds.length);

  await page.goto("/artifacts");
  // Text cards show the start of the text, not a placeholder.
  // (Cards strip markdown, so pick one whose first line has none.)
  const firstLine = (a: { textPreview?: string | null }) => (a.textPreview ?? "").trim().split("\n")[0];
  const withText = first.items.find((a) => firstLine(a).length > 20 && !/[*_#`>\[\]]/.test(firstLine(a)));
  if (withText) await expect(page.locator("main button").filter({ hasText: firstLine(withText).slice(0, 30) }).first()).toBeVisible();

  // Open the first card, then step forward and back.
  await page.locator("main button").filter({ hasText: /Text|Image|Audio|Video|E2E|Launch/ }).first().click();
  const viewer = page.getByRole("dialog");
  await expect(viewer.getByText(/^1 \/ \d+\+?$/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText(/^2 \/ \d+\+?$/)).toBeVisible();
  await viewer.getByRole("button", { name: "Previous artifact" }).click();
  await expect(viewer.getByText(/^1 \/ \d+\+?$/)).toBeVisible();
  await viewer.getByRole("button", { name: "Close viewer" }).click();
  await expect(viewer).toBeHidden();

  // Search by project name.
  const project = first.items[0].projectName;
  const searched = page.waitForRequest((r) => r.url().includes("/api/artifacts?") && r.url().includes("q="));
  await page.getByLabel("Search artifacts").fill(project);
  await searched;
  // (The project filter's <option> has the name too, so look at the cards.)
  await expect(page.locator("main button").filter({ hasText: project }).first()).toBeVisible();
  await page.getByLabel("Search artifacts").fill("zz-no-such-artifact-zz");
  await expect(page.getByText("Nothing matches")).toBeVisible();
});
