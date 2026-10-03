import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

/** How many rows a list has beyond its first page, according to the API. */
async function hasSecondPage(page: Page, path: string, limit: number) {
  const first = await (await page.request.get(`/api${path}${path.includes("?") ? "&" : "?"}paged=1&limit=${limit}`)).json();
  return Boolean(first.nextCursor);
}

test("runs: load more pages of agent runs and workflow runs", async ({ page }) => {
  for (const [type, path, noun] of [
    ["agents", "/workflows/recent", "agent runs"],
    ["workflows", "/template-runs?status=all", "workflow runs"],
  ] as const) {
    await page.goto(`/runs?type=${type}`);
    const footer = page.getByText(new RegExp(`^(Showing the latest \\d+|All \\d+) ${noun}$`));
    await expect(footer).toBeVisible();
    if (!(await hasSecondPage(page, path, 30))) {
      await expect(footer).toHaveText(new RegExp(`^All \\d+ ${noun}$`));
      continue;
    }
    await expect(footer).toHaveText(`Showing the latest 30 ${noun}`);
    const loads = page.waitForRequest((r) => r.url().includes("paged=1") && r.url().includes("cursor="));
    await page.getByRole("button", { name: "Load more" }).click();
    await loads;
    await expect(footer).not.toHaveText(`Showing the latest 30 ${noun}`);
    const shown = Number((await footer.textContent())!.match(/\d+/)![0]);
    expect(shown).toBeGreaterThan(30);
  }
});

test("artifacts: load more", async ({ page }) => {
  await page.goto("/artifacts");
  const footer = page.getByText(/^(Showing the latest \d+|All \d+) artifacts$/);
  await expect(footer).toBeVisible();
  test.skip(!(await hasSecondPage(page, "/artifacts", 48)), "fewer than one page of artifacts");
  await expect(footer).toHaveText("Showing the latest 48 artifacts");
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(footer).not.toHaveText("Showing the latest 48 artifacts");
});

test("the existing list endpoints still answer with plain arrays", async ({ page }) => {
  for (const path of ["/workflows/recent?limit=3", "/template-runs?status=all&limit=3", "/events?limit=3", "/notifications", "/artifacts?limit=3"]) {
    const body = await (await page.request.get(`/api${path}`)).json();
    expect(Array.isArray(body), path).toBe(true);
  }
});
