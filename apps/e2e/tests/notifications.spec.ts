import { expect, test } from "@playwright/test";

test("notifications: pushed live, mark read, delete", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Account menu/ })).toBeVisible();
  await page.waitForTimeout(800); // let the notification stream connect
  const title = `E2E notice ${Date.now()}`;
  const created = await page.request.post("/api/notifications", { data: { type: "info", title, message: "hello from e2e" } });
  expect(created.status(), await created.text()).toBe(201);

  // Arrives over the stream as a toast without a reload.
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: "Notifications" }).click();
  const item = page.locator("div").filter({ hasText: title }).last();
  await expect(item).toBeVisible();
  await page.getByRole("button", { name: /Mark all/i }).click();

  // The UI marks them read optimistically; poll until the server agrees.
  type Row = { id: string; title: string; read?: boolean; isRead?: boolean };
  const mineNow = async () => ((await (await page.request.get("/api/notifications")).json()) as Row[]).find((n) => n.title === title);
  await expect.poll(async () => { const n = await mineNow(); return n?.read ?? n?.isRead; }).toBe(true);
  const mine = await mineNow();
  await page.request.delete(`/api/notifications/${mine!.id}`);
});
