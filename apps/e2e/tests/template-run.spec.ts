import { expect, test } from "@playwright/test";

test("workflow run form: run now, add and remove a schedule", async ({ page }) => {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E RunForm ${Date.now()}` } })).json();
  const tpl = await (
    await page.request.post(`/api/projects/${project.id}/templates`, {
      data: {
        name: `E2E RunForm ${Date.now()}`,
        steps: [{ stepOrder: 0, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromRunInput", field: "message" } } }],
      },
    })
  ).json();

  await page.goto(`/templates/${tpl.id}/run`);
  await expect(page.getByRole("heading", { name: `Run: ${tpl.name}` })).toBeVisible();

  // Schedule: add, see it listed, remove with confirmation.
  await page.getByPlaceholder("0 9 * * 2 (e.g. Tuesday at 9am)").fill("0 9 * * 1");
  await page.getByRole("button", { name: /Set Schedule/ }).click();
  await expect(page.getByText(/Workflow scheduled/)).toBeVisible();
  await expect(page.getByText("0 9 * * 1", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Remove schedule" }).click();
  await page.getByRole("button", { name: /Remove|Delete|Confirm/ }).filter({ hasNotText: "schedule" }).first().click();
  await expect(page.getByText("Schedule removed")).toBeVisible();

  // Run now with the required input opens the run.
  await page.getByPlaceholder("Enter message...").fill("hello from the run form");
  await page.getByRole("button", { name: /Run now/ }).click();
  await expect(page).toHaveURL(/\/template-runs\/[0-9a-f-]{36}$/);
  const runId = page.url().split("/").pop()!;
  await page.request.post(`/api/template-runs/${runId}/cancel`);
});
