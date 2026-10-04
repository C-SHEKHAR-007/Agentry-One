import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("providers: set a model's token prices", async ({ page }) => {
  const name = `E2E Pricing ${Date.now()}`;
  const provider = await (
    await page.request.post("/api/providers", {
      data: { capabilityKey: "web-search", providerType: "custom_http", name, baseUrl: "http://127.0.0.1:9", authMode: "none", config: {}, isDefault: false },
    })
  ).json();
  const model = await (
    await page.request.post("/api/models", {
      data: { providerConfigId: provider.id, modelId: "e2e-priced-model", name: "E2E Priced Model", inputTypes: ["text"], outputTypes: ["text"] },
    })
  ).json();

  await page.goto("/providers");
  const card = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .filter({ has: page.getByRole("button", { name: /View Available Models|Hide Models/ }) })
    .last();
  // Wait for the list to load before opening this provider's models panel.
  await card.getByRole("button", { name: /View Available Models/ }).click();

  await page.getByRole("button", { name: "Token prices for E2E Priced Model" }).click();
  const dialog = page.getByRole("dialog", { name: "Token prices" });
  await dialog.getByLabel("Input, $ per 1M tokens").fill("3");
  await dialog.getByLabel("Output, $ per 1M tokens").fill("15");
  await dialog.getByRole("button", { name: "Save prices" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("$3 / $15 per 1M")).toBeVisible();

  const models: Array<{ id: string; inputPricePerMTok: number | null; outputPricePerMTok: number | null }> = await (
    await page.request.get(`/api/providers/${provider.id}/models`)
  ).json();
  expect(models.find((m) => m.id === model.id)).toMatchObject({ inputPricePerMTok: 3, outputPricePerMTok: 15 });

  // Negative prices are refused by the API.
  expect((await page.request.patch(`/api/models/${model.id}`, { data: { inputPricePerMTok: -1 } })).status()).toBe(400);

  await page.request.delete(`/api/providers/${provider.id}`);
});
