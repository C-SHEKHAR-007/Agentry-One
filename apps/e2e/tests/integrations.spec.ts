import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("integrations: connect a Telegram channel directly, list it, disconnect", async ({ page }) => {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Integrations ${Date.now()}` } })).json();
  const handle = `@e2e_${Date.now()}`;

  await page.goto("/integrations");
  await expect(page.getByRole("heading", { name: "Integrations", exact: true })).toBeVisible();
  const scope = page.locator("select").filter({ has: page.locator("option", { hasText: project.name }) });
  if (await scope.count()) await scope.selectOption(project.id);
  await expect(page.getByText(/No social accounts connected to this project yet/)).toBeVisible();

  // Pick Telegram from the platform cards and connect with a bot token + chat id.
  await page.locator("div").filter({ has: page.getByRole("heading", { name: "Telegram Channel / Group" }) }).filter({ hasText: "Connect Directly" }).last().click();
  const dialog = page.getByRole("dialog", { name: "Connect an account" });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ").fill("123456:e2e-token");
  await dialog.getByPlaceholder("e.g. @your_channel or -100123456789").fill(handle);
  await dialog.getByRole("button", { name: /Save & Connect Account/ }).click();
  await expect(dialog).toBeHidden();

  const row = page.locator("div").filter({ hasText: handle }).filter({ has: page.getByRole("button", { name: /Test Connection/ }) }).last();
  await expect(row).toBeVisible();
  await expect(row.getByText("Connected & Ready")).toBeVisible();

  // The account is visible to the API too, scoped to this project.
  const accounts: Array<{ id: string; handle: string }> = await (await page.request.get(`/api/social-accounts?projectId=${project.id}`)).json();
  expect(accounts.some((a) => a.handle === handle)).toBe(true);

  // Disconnect (the last button on the row).
  await row.getByRole("button").last().click();
  await expect(page.getByText(handle)).toHaveCount(0);
  await page.request.delete(`/api/projects/${project.id}`);
});
