import { expect, test } from "@playwright/test";

test("settings: platform status and theme preference persist", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByText("API Server")).toBeVisible();
  await page.getByRole("button", { name: /^Light$/ }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: /^Dark$/ }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("settings: save a global setting", async ({ page }) => {
  await page.goto("/settings");
  const key = `e2e.setting.${Date.now()}`;
  await page.getByPlaceholder("key (e.g. ui.motd)").fill(key);
  await page.locator("form").filter({ has: page.getByPlaceholder("key (e.g. ui.motd)") }).locator("input, textarea").nth(1).fill('"hello"');
  await page.locator("form").filter({ has: page.getByPlaceholder("key (e.g. ui.motd)") }).getByRole("button").click();
  await expect(page.getByText("Setting saved")).toBeVisible();
});

test("profile: update the display name and restore it", async ({ page }) => {
  const me = await (await page.request.get("/api/auth/me")).json();
  const original = me.user?.lastName ?? me.lastName ?? "";
  await page.goto("/profile");
  const last = page.getByPlaceholder("e.g. Rivera");
  await last.fill(`E2E ${Date.now()}`);
  await page.getByRole("button", { name: /Save Profile/ }).click();
  await expect(page.getByText("Profile updated successfully")).toBeVisible();
  await last.fill(original);
  await page.getByRole("button", { name: /Save Profile/ }).click();
});
