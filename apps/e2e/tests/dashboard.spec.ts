import { expect, test } from "@playwright/test";
import { E2E_EMAIL } from "./env";

test("dashboard loads for a signed-in user", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/Agentry/i);
  // The user menu shows who is signed in.
  await expect(page.getByRole("button", { name: new RegExp(E2E_EMAIL.split("@")[0], "i") })).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown routes show a not-found page instead of an empty layout", async ({ page }) => {
  await page.goto("/definitely-not-a-page");
  await expect(page.getByText("This page doesn't exist")).toBeVisible();
});

test("a missing workflow shows not-found instead of loading forever", async ({ page }) => {
  await page.goto("/workflows/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("This workflow doesn't exist")).toBeVisible({ timeout: 10_000 });
});
