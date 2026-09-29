import { expect, test } from "@playwright/test";

test("team: add a member, change role, remove", async ({ page }) => {
  const email = `e2e.member.${Date.now()}@example.com`;
  await page.goto("/team");
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add member" });
  await dialog.locator('input[type="email"]').fill(email);
  await dialog.locator('input[type="password"]').fill("member-pass-123");
  await dialog.getByRole("button", { name: /^Add/ }).click();
  await expect(dialog).toBeHidden();

  const row = page.locator("div").filter({ hasText: email }).filter({ has: page.getByRole("combobox") }).last();
  await expect(row).toBeVisible();
  await row.getByRole("combobox").selectOption("owner");
  await expect(page.getByText("Role updated")).toBeVisible();
  await row.getByRole("combobox").selectOption("member");

  await page.getByRole("button", { name: `Remove ${email}` }).click();
  await expect(page.getByText(email)).toHaveCount(0);
});
