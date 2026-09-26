import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./env";

// Uses a fresh, signed-out browser context.
test.use({ storageState: { cookies: [], origins: [] } });

test("deep links survive the login redirect", async ({ page }) => {
  await page.goto("/executions");
  await expect(page).toHaveURL(/\/login$/);
  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/executions$/);
});

test("signing out ends the session", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: new RegExp(E2E_EMAIL.split("@")[0], "i") }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);
});
