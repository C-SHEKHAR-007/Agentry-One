import { expect, test, type APIRequestContext } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

type RunStep = { status: string; workflowId: string | null; reusedFromStepId?: string | null; templateStep: { stepOrder: number } };
type Run = { id: string; status: string; retryOfId?: string | null; steps: RunStep[] };

const getRun = async (request: APIRequestContext, id: string): Promise<Run> => (await request.get(`/api/template-runs/${id}`)).json();
const byOrder = (run: Run) => [...run.steps].sort((a, b) => a.templateStep.stepOrder - b.templateStep.stepOrder);

// A retry starts a new run that reuses the steps that completed and runs the
// rest again. The run is made to fail by cancelling a step's agent run
// (immediate while its job is still queued), so this works with or without
// a live worker; if a worker finishes both steps first, the retry starts
// from step 2 instead.
test("retry a workflow run: reuses completed steps, reruns the rest", async ({ page }) => {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Retry ${Date.now()}` } })).json();
  const template = await (
    await page.request.post(`/api/projects/${project.id}/templates`, {
      data: {
        name: `E2E retry ${Date.now()}`,
        steps: [
          { stepOrder: 0, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromRunInput", field: "greeting" } } },
          { stepOrder: 1, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } } },
        ],
      },
    })
  ).json();
  const original = await (await page.request.post(`/api/templates/${template.id}/run`, { data: { greeting: "hello retry" } })).json();

  // Fail the first step that hasn't completed yet.
  await expect
    .poll(
      async () => {
        const run = await getRun(page.request, original.id);
        if (["failed", "completed"].includes(run.status)) return run.status;
        const step = byOrder(run).find((s) => s.status !== "completed" && s.workflowId);
        if (step) await page.request.post(`/api/workflows/${step.workflowId}/cancel`);
        return run.status;
      },
      { timeout: 30_000, intervals: [300, 500, 1000] },
    )
    .toMatch(/^(failed|completed)$/);
  const before = await getRun(page.request, original.id);
  const completedBefore = byOrder(before).filter((s) => s.status === "completed").map((s) => s.templateStep.stepOrder);

  await page.goto(`/template-runs/${original.id}`);
  if (before.status === "failed") {
    // The banner says what failed and starts the retry.
    await expect(page.getByText(/^Step \d · .* failed\.$/)).toBeVisible();
    await page.getByRole("button", { name: "Retry from failed step" }).click();
  } else {
    // Everything completed: run again from step 2 (the inspector shows the last step).
    await page.getByRole("button", { name: "Run again from this step" }).click();
  }

  await expect(page).not.toHaveURL(new RegExp(`/template-runs/${original.id}$`));
  await expect(page).toHaveURL(/\/template-runs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: /Retry of/ })).toBeVisible();
  const retryId = page.url().split("/").pop()!;

  const retry = await getRun(page.request, retryId);
  expect(retry.retryOfId).toBe(original.id);
  const reused = byOrder(retry).filter((s) => s.reusedFromStepId).map((s) => s.templateStep.stepOrder);
  // Exactly the steps that had completed are reused (step 2 is always rerun).
  expect(reused).toEqual(before.status === "completed" ? [0] : completedBefore);
  if (reused.length > 0) await expect(page.getByText("Reused", { exact: true }).first()).toBeVisible();

  // The original run is left as it was.
  expect((await getRun(page.request, original.id)).status).toBe(before.status);
  // A run that's still going can't be retried.
  const live = await getRun(page.request, retryId);
  if (!["completed", "failed", "cancelled"].includes(live.status)) {
    expect((await page.request.post(`/api/template-runs/${retryId}/retry`, { data: {} })).status()).toBe(409);
  }

  await page.request.delete(`/api/projects/${project.id}`);
});
