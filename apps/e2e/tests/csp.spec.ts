import { expect, test } from "@playwright/test";
// Meaningful against the nginx deployment (E2E_BASE_URL), which sends the CSP.
test("no CSP violations or page errors across main routes", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  for (const route of ["/", "/projects", "/agents", "/executions", "/artifacts", "/analytics", "/providers", "/builder", "/studio", "/integrations", "/profile", "/settings", "/team", "/costs", "/prompts"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
  }
  expect(problems).toEqual([]);
});
