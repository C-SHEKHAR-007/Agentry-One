import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

/** The run either stays queued (no worker for this agent, e.g. a bare API
 * stack) or is picked up and fails (the compose stack's worker rejects the
 * bogus file input). Both are real states the page must explain. */
async function settledState(page: Page): Promise<"queued" | "failed"> {
  const queued = page.getByText("Waiting for a worker to pick this up…");
  const failed = page.getByRole("heading", { name: "An input pointed somewhere it isn't allowed to" });
  await expect(queued.or(failed)).toBeVisible({ timeout: 20_000 });
  // Give a worker a moment to pick it up before concluding it's idle.
  await page.waitForTimeout(3000);
  return (await failed.isVisible()) ? "failed" : "queued";
}

test("run details: header, inputs, failure explanation or cancel, run again", async ({ page }) => {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Run ${Date.now()}` } })).json();
  const started = await page.request.post(`/api/projects/${project.id}/workflows`, {
    data: { agentId: "video-agent", input: { imagePath: "missing.png", caption: "Hello\nsecond line", durationSec: 6 } },
  });
  expect(started.status(), await started.text()).toBe(201);
  const wf = await started.json();

  await page.goto(`/workflows/${wf.id}`);

  // Header: agent name (not its id), project link, short run id.
  await expect(page.getByRole("heading", { name: "Video Agent" })).toBeVisible();
  await expect(page.getByRole("link", { name: project.name }).first()).toHaveAttribute("href", `/projects/${project.id}`);
  await expect(page.getByRole("button", { name: `#${wf.id.slice(0, 8)}` })).toBeVisible();

  // Inputs render readably (multi-line text kept, numbers shown).
  await expect(page.getByText("Hello\nsecond line")).toBeVisible();
  await expect(page.getByText("durationSec")).toBeVisible();

  const state = await settledState(page);
  if (state === "failed") {
    // Why it failed: plain-language hint plus the worker's exact error.
    await expect(page.getByText("Failed", { exact: true }).first()).toBeVisible();
    await expect(page.locator("pre").filter({ hasText: "not an artifact reference" })).toBeVisible();
    await expect(page.getByText("Nothing was produced — the run failed.")).toBeVisible();
  } else {
    await expect(page.getByText("Queued", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("The output will appear here when the run finishes.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  }

  // Run again starts a new run with the same inputs and opens it.
  await page.getByRole("button", { name: "Run again" }).first().click();
  await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]{36}$/);
  await expect(page).not.toHaveURL(new RegExp(wf.id));
  await expect(page.getByText("Hello\nsecond line")).toBeVisible();

  // Leave nothing queued behind.
  const cancel = page.getByRole("button", { name: "Cancel" });
  if (await cancel.isVisible()) await cancel.click();
});

test("run details: unknown run shows not-found", async ({ page }) => {
  await page.goto("/workflows/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("This run doesn't exist")).toBeVisible();
});
