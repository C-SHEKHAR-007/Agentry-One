import http from "node:http";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

// The browser never talks to the Instagram helper: every call goes to the
// API (same origin, so the CSP's connect-src 'self' holds), which proxies it.
const helperPort = Number(process.env.E2E_IG_HELPER_PORT || 0);

async function openInstagramDialog(page: import("@playwright/test").Page) {
  const helperCalls: string[] = [];
  const problems: string[] = [];
  page.on("request", (r) => {
    if (/:4005\b|browser-login/.test(r.url())) helperCalls.push(r.url());
  });
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to connect/i.test(m.text())) problems.push(m.text());
  });
  await page.goto("/integrations");
  await page.locator("div").filter({ has: page.getByRole("heading", { name: "Instagram", exact: true }) }).filter({ hasText: "Connect Directly" }).last().click();
  const dialog = page.getByRole("dialog", { name: "Connect an account" });
  await expect(dialog).toBeVisible();
  return { dialog, helperCalls, problems };
}

test("instagram browser login: says so when the helper isn't running", async ({ page }) => {
  test.skip(Boolean(helperPort), "a fake helper is configured for this run");
  const { dialog, helperCalls, problems } = await openInstagramDialog(page);
  await expect(dialog.getByText("Local browser helper daemon is currently offline.")).toBeVisible();
  expect(helperCalls.length).toBeGreaterThan(0);
  expect(helperCalls.every((u) => new URL(u).pathname.startsWith("/api/integrations/instagram/browser-login/"))).toBe(true);
  expect(problems).toEqual([]);
});

test("instagram browser login: start, wait, connected (fake helper)", async ({ page }) => {
  test.skip(!helperPort, "set E2E_IG_HELPER_PORT and point the API's INSTAGRAM_HELPER_URL at it");
  let polls = 0;
  const helper = http.createServer((req, res) => {
    const json = (d: unknown) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(d));
    req.resume();
    if (req.url === "/status") return json({ ready: true, session_status: "idle" });
    if (req.url === "/login/start") return json({ started: true, status: "in_progress" });
    if (req.url === "/login/status") return json(++polls < 3 ? { status: "in_progress", elapsed: polls } : { status: "success", handle: "@e2e_fake" });
    if (req.url === "/login/cancel") return json({ canceled: true });
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => helper.listen(helperPort, "127.0.0.1", r));
  try {
    const { dialog, helperCalls, problems } = await openInstagramDialog(page);
    await expect(dialog.getByText("Local browser helper daemon is currently offline.")).toHaveCount(0);
    await dialog.getByRole("button", { name: /Open Instagram in Browser/ }).click();
    await expect(dialog.getByText(/Waiting for login in Chrome window/)).toBeVisible();
    await expect(page.getByText(/Instagram account @e2e_fake connected successfully/)).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toBeHidden();
    expect(helperCalls.every((u) => new URL(u).pathname.startsWith("/api/"))).toBe(true);
    expect(problems).toEqual([]);
  } finally {
    await new Promise<void>((r) => helper.close(() => r()));
  }
});
