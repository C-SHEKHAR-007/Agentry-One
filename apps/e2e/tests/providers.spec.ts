import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

type Provider = { id: string; name: string; isDefault: boolean; capability?: { key: string } };

/** The provider card for `name`: the innermost block holding its heading and its models toggle. */
const card = (page: Page, name: string) =>
  page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .filter({ has: page.getByRole("button", { name: /View Available Models|Hide Models/ }) })
    .last();

test("providers: register, edit, add a model, set default, delete", async ({ page }) => {
  let providers: Provider[] = await (await page.request.get("/api/providers")).json();
  // Leftovers from an interrupted earlier run.
  for (const p of providers.filter((p) => p.name.startsWith("E2E Provider "))) await page.request.delete(`/api/providers/${p.id}`);
  providers = await (await page.request.get("/api/providers")).json();
  const previousDefault = providers.find((p) => p.isDefault && p.capability?.key === "web-search");
  const name = `E2E Provider ${Date.now()}`;

  await page.goto("/providers");
  await page.getByRole("button", { name: "Register AI Provider" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Register AI provider" });
  await expect(dialog).toBeVisible();
  await dialog.locator("select").first().selectOption({ value: "web-search" });
  await dialog.locator("select").nth(1).selectOption("custom_http");
  await dialog.getByPlaceholder("e.g. OpenAI Cloud, Local Ollama").fill(name);
  await dialog.getByPlaceholder(/e\.g\. https:\/\/api\.openai\.com\/v1 or/).fill("http://127.0.0.1:9");
  await dialog.getByRole("button", { name: /Add & Sync Models/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  // Edit: rename.
  const renamed = `${name} (edited)`;
  await card(page, name).getByTitle("Edit Provider Settings").click();
  const edit = page.getByRole("dialog", { name: "Edit provider" });
  await expect(edit).toBeVisible();
  await edit.locator('input[type="text"], input:not([type])').first().fill(renamed);
  await edit.getByRole("button", { name: "Save Changes" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByRole("heading", { name: renamed, exact: true })).toBeVisible();

  // Add a model through the models panel.
  const c = card(page, renamed);
  const toggle = c.getByRole("button", { name: /View Available Models/ });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: renamed, exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Add Model" }) })
    .last()
    .getByRole("button", { name: "Add Model" })
    .click();
  const add = page.getByRole("dialog", { name: "Add a model" });
  await add.getByPlaceholder(/e\.g\. llama-3\.3-70b/).fill("e2e-model-1");
  await add.getByRole("button", { name: "Register Model" }).click();
  await expect(add).toBeHidden();
  await expect(page.getByText("e2e-model-1").first()).toBeVisible();

  // Set default, then put the previous default back so other suites are unaffected.
  await card(page, renamed).getByRole("button", { name: /Set Default/ }).click();
  await expect(card(page, renamed).getByText(/Active/).first()).toBeVisible();
  if (previousDefault) await page.request.post(`/api/providers/${previousDefault.id}/set-default`);

  // Delete.
  await card(page, renamed).getByTitle("Delete Provider").click();
  await expect(page.getByRole("heading", { name: renamed, exact: true })).toHaveCount(0);
});

test("providers: search and modality filter", async ({ page }) => {
  await page.goto("/providers");
  await expect(page.getByRole("heading", { name: "AI Providers" })).toBeVisible();
  await page.getByPlaceholder("Search providers, model IDs, endpoints...").fill("definitely-no-such-provider");
  await expect(page.getByText("No Providers Found")).toBeVisible();
  await page.getByPlaceholder("Search providers, model IDs, endpoints...").fill("");
  await page.getByRole("tab", { name: /Image/ }).or(page.getByRole("button", { name: /^Image$/ })).first().click();
  await expect(page.getByText(/SD-Turbo|Stability/).first()).toBeVisible();
});
