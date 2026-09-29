import { expect, test } from "@playwright/test";

test("project detail: templates and artifacts sections, delete with confirmation", async ({ page }) => {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Detail ${Date.now()}` } })).json();
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  await expect(page.getByText("Templates", { exact: true })).toBeVisible();
  // An empty project has no "Recent Artifacts" section yet.

  await page.getByRole("button", { name: "Delete project" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Delete/ }).last().click();
  await expect(page).toHaveURL(/\/projects$/);
  expect((await page.request.get(`/api/projects/${project.id}`)).status()).toBe(404);
});
