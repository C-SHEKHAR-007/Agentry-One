import { expect, test } from "@playwright/test";

test("prompt library: create, version, compare, search, use in run, delete", async ({ page }) => {
  const key = `e2e-${Date.now()}`;

  // Create
  await page.goto("/prompts");
  await page.getByRole("button", { name: "New prompt" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Agent").selectOption("sketch-agent");
  await dialog.getByLabel("Key").fill(key);
  await dialog.getByLabel("Prompt text").fill("A pencil sketch of {{subject}}\nsoft light");
  await expect(dialog.getByText("subject", { exact: true })).toBeVisible(); // live placeholder detection
  await dialog.getByRole("button", { name: "Create prompt" }).click();

  // Newly created prompt is selected and shown with its placeholder.
  const detail = page.locator("h2", { hasText: key });
  await expect(detail).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`prompt=sketch-agent(%3A|:)${key}`));

  // New version (unchanged text can't be saved)
  await page.getByRole("button", { name: "New version" }).click();
  const saveV2 = page.getByRole("dialog").getByRole("button", { name: "Save v2" });
  await expect(saveV2).toBeDisabled();
  await page.getByRole("dialog").getByLabel("Prompt text").fill("A pencil sketch of {{subject}}\nsoft morning light\ngraphite texture");
  await saveV2.click();
  const header = page.locator("h2", { hasText: key }).locator("..");
  await expect(header.getByText("v2", { exact: true })).toBeVisible();
  await expect(header.getByText("Latest", { exact: true })).toBeVisible();
  const history = page.getByRole("list").filter({ hasText: "v1" });
  await expect(history.getByRole("button")).toHaveCount(2);

  // Compare
  await page.getByRole("tab", { name: /Changes from v1/ }).click();
  await expect(page.getByText("+2 added")).toBeVisible();
  await expect(page.getByText("soft light")).toBeVisible(); // the removed line

  // Search narrows the list
  await page.getByLabel("Search prompts").fill(key);
  await expect(page.getByRole("button", { name: new RegExp(key) })).toHaveCount(1);
  await page.getByLabel("Search prompts").fill("definitely-no-such-prompt-xyz");
  await expect(page.getByText("No prompts match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();

  // Use in run pre-fills the agent's form
  await page.getByRole("link", { name: "Use in run" }).click();
  await expect(page).toHaveURL(/\/agents\/sketch-agent\/submit\?prompt=/);
  await expect(page.getByText(`Inserted "${key}" v2`)).toBeVisible();

  // Delete v2 (with confirmation), then the last version removes the prompt
  await page.goto(`/prompts?prompt=sketch-agent:${key}`);
  await page.getByRole("button", { name: "Delete v2" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete v1" })).toBeVisible();
  await page.getByRole("button", { name: "Delete v1" }).click();
  await expect(page.getByText("this removes the prompt")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator("h2", { hasText: key })).toHaveCount(0);
});
