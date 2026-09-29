import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

// Runs under the production Content-Security-Policy (vite preview and nginx
// both send it). The generated form's validator used to need eval, which the
// policy blocks -- submitting failed with "Evaluating a string as JavaScript
// violates the following Content Security Policy directive".
test("submit an agent run: schema validation works under the CSP", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|unsafe-eval|Refused to/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

  await page.request.post("/api/projects", { data: { name: `E2E Submit ${Date.now()}` } });
  await page.goto("/agents/sketch-agent/submit");
  await expect(page.locator("#root_prompt")).toBeVisible();

  // The browser's own constraint checks (required, min/max) run first; the
  // schema validator runs on submit of otherwise-valid input -- which is
  // exactly where the eval-based validator used to crash.
  await page.locator("#root_prompt").fill("a lighthouse at dawn");
  // Valid input passes validation, starts the run and opens it.
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]{36}$/);
  await expect(page.getByText("a lighthouse at dawn")).toBeVisible();

  expect(problems).toEqual([]);

  const cancel = page.getByRole("button", { name: "Cancel" });
  if (await cancel.isVisible()) await cancel.click();
});
