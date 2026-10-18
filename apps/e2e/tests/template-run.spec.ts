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

  // Schedule with the builder: Mondays at 09:00, saved with the browser's timezone.
  await page.getByLabel("Repeat").selectOption("weekly");
  await page.getByRole("button", { name: "Tue", exact: true }).click(); // the default day, off
  await page.getByRole("button", { name: "Mon", exact: true }).click();
  await page.getByLabel("At", { exact: true }).fill("09:00");
  await expect(page.getByTestId("next-runs")).toContainText("Mon");
  await page.getByRole("button", { name: /Set schedule/ }).click();
  await expect(page.getByText("Scheduled: Mon at 09:00")).toBeVisible();
  const active = page.getByText("Active schedules").locator("..");
  await expect(active.getByText("Mon at 09:00")).toBeVisible();
  const [saved] = await (await page.request.get(`/api/templates/${tpl.id}/schedules`)).json();
  expect(saved).toMatchObject({ cronExpr: "0 9 * * 1", timezone: await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone) });
  await page.getByRole("button", { name: "Remove schedule" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Schedule removed")).toBeVisible();

  // Run now with the required input opens the run.
  // The input is labelled from the agent's schema, under its step.
  await page.getByLabel(/message/i).fill("hello from the run form");
  await page.getByRole("button", { name: /Run now/ }).click();
  await expect(page).toHaveURL(/\/template-runs\/[0-9a-f-]{36}$/);
  const runId = page.url().split("/").pop()!;
  await page.request.post(`/api/template-runs/${runId}/cancel`);
});
