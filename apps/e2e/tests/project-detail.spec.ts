import { expect, test } from "@playwright/test";

test("project detail: overview, workflows and artifacts tabs, delete with confirmation", async ({ page }) => {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Detail ${Date.now()}` } })).json();
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();

  // Overview: 30-day stats, empty for a new project.
  await expect(page.getByText("Runs · 30 days")).toBeVisible();
  await expect(page.getByText("Nothing finished yet")).toBeVisible();

  // The tab is kept in the URL.
  await page.getByRole("button", { name: /Workflows/ }).first().click();
  await expect(page).toHaveURL(/\?tab=workflows$/);
  await expect(page.getByText(/No workflows yet/)).toBeVisible();
  await page.getByRole("button", { name: /Artifacts/ }).first().click();
  await expect(page).toHaveURL(/\?tab=artifacts$/);
  await expect(page.getByText("No artifacts yet")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No artifacts yet")).toBeVisible();

  await page.getByRole("button", { name: "Delete project" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Delete/ }).last().click();
  await expect(page).toHaveURL(/\/projects$/);
  expect((await page.request.get(`/api/projects/${project.id}`)).status()).toBe(404);
});
