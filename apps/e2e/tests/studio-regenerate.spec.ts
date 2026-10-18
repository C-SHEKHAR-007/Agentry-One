import { expect, test, type APIRequestContext } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

/** Waits for a workflow run to settle; null if no worker picked it up in time. */
async function settled(request: APIRequestContext, runId: string, ms = 60_000): Promise<string | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const run = await (await request.get(`/api/template-runs/${runId}`)).json();
    if (["completed", "failed", "cancelled"].includes(run.status)) return run.status;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

test("studio: regenerate one output with a note, switch versions, make variants", async ({ page }) => {
  test.setTimeout(180_000);
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Regen ${Date.now()}` } })).json();
  const tpl = await (
    await page.request.post(`/api/projects/${project.id}/templates`, {
      data: {
        name: `Brief: E2E regen ${Date.now()}`,
        steps: [{ stepOrder: 0, agentId: "sketch-agent", agentStepKey: "generate", inputMapping: { prompt: { kind: "fromRunInput", field: "topic" } } }],
      },
    })
  ).json();
  const run = await (await page.request.post(`/api/templates/${tpl.id}/run`, { data: { topic: "a lighthouse at dawn" } })).json();
  const status = await settled(page.request, run.id);
  test.skip(status === null, "needs a live worker");
  expect(status).toBe("completed");

  await page.goto(`/studio?run=${run.id}`);
  await page.getByRole("button", { name: /Regenerate/ }).click();
  await page.getByLabel("Note for the new visual").fill("warmer colours");
  await page.getByRole("button", { name: "Go" }).click();

  // The regenerate opens as its own run, which reruns only the visual with the note.
  await expect(page).not.toHaveURL(new RegExp(`run=${run.id}`));
  const retryId = new URL(page.url()).searchParams.get("run")!;
  const retry = await (await page.request.get(`/api/template-runs/${retryId}`)).json();
  expect(retry.retryOfId).toBe(run.id);
  expect(await settled(page.request, retryId)).toBe("completed");

  // Both versions are there to switch between.
  await expect(page.getByRole("button", { name: "v2" })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await page.getByRole("button", { name: "v1" }).click();
  await expect(page.getByRole("button", { name: "v1" })).toHaveAttribute("aria-pressed", "true");

  // Variants top it up to three.
  await page.getByRole("button", { name: /3 variants/ }).click();
  await expect(page.getByText(/Making 1 more visual variant/)).toBeVisible();
  await expect(page.getByRole("button", { name: "v3" })).toBeVisible({ timeout: 60_000 });
});
