import { expect, test } from "@playwright/test";

test("create a project and open it", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: /new project/i }).first().click();

  const name = `E2E Project ${Date.now()}`;
  await page.getByPlaceholder("Project name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();

  const card = page.getByText(name, { exact: true });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
});
