import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("agents: list, filter, tabs and agent detail", async ({ page }) => {
  await page.goto("/agents");
  await expect(page.getByRole("heading", { name: "AI Agents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sketch Agent" })).toBeVisible();
  await page.getByPlaceholder("Filter agents...").fill("sketch");
  await expect(page.getByRole("heading", { name: "Echo Agent" })).toHaveCount(0);
  await page.getByPlaceholder("Filter agents...").fill("");

  await page.getByRole("tab", { name: /Worker Diagnostics/ }).or(page.getByRole("button", { name: /Worker Diagnostics/ })).first().click();
  await expect(page.getByRole("button", { name: /Rescan Registry/ })).toBeVisible();

  await page.goto("/agents/sketch-agent");
  await expect(page.getByRole("heading", { name: "Sketch Agent" })).toBeVisible();
  await expect(page.getByText("Total Runs")).toBeVisible();
  await page.getByRole("link", { name: /Run this agent/ }).click();
  await expect(page).toHaveURL(/\/agents\/sketch-agent\/submit$/);
});

test("agents: create a custom agent, find it, delete it", async ({ page }) => {
  const name = `E2E Custom ${Date.now()}`;
  await page.goto("/agents/create-skill");
  await expect(page.getByRole("heading", { name: "Create an agent" })).toBeVisible();
  await page.getByPlaceholder("e.g., Instagram Reel Copywriter").fill(name);
  await page.getByPlaceholder("What does this agent accomplish?").fill("Created by the e2e suite");
  await page.getByPlaceholder("You are an expert AI...").fill("Summarise {{topic}} in one line.");
  await page.getByRole("button", { name: /Save & Publish Agent/ }).click();
  await expect(page.getByText(`Agent "${name}" created and registered!`)).toBeVisible();

  const agents: Array<{ id: string; name: string }> = await (await page.request.get("/api/agents")).json();
  const created = agents.find((a) => a.name === name);
  expect(created).toBeTruthy();
  await page.goto("/agents");
  await expect(page.getByRole("heading", { name })).toBeVisible();

  expect((await page.request.delete(`/api/agents/${created!.id}`)).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
});

test("agents: scaffold dialog opens and validates", async ({ page }) => {
  await page.goto("/agents");
  await page.getByRole("button", { name: /Scaffold Code/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("e.g. echo-agent")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
