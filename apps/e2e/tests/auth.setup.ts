import { expect, test as setup } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./env";

/** Signs in once through the real login form (completing first-run setup
 * via the API if needed) and saves the session for the other specs. */
setup("authenticate", async ({ page, request }) => {
  const status = await (await request.get("/api/auth/setup-status")).json();
  if (status.needsSetup) {
    const res = await request.post("/api/auth/setup", { data: { email: E2E_EMAIL, password: E2E_PASSWORD } });
    expect(res.status(), await res.text()).toBe(201);
  }

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: ".auth/user.json" });
});
