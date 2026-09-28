import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("content studio: plan preview, generate, live run, reopen from recent", async ({ page }) => {
  // Needs a project to generate into.
  await page.request.post("/api/projects", { data: { name: `E2E Studio ${Date.now()}` } });

  await page.goto("/studio");
  await page.evaluate(() => localStorage.removeItem("agentry.studio.draft"));
  await page.reload();

  const generate = page.getByRole("button", { name: "Generate content" });
  await expect(generate).toBeDisabled(); // no topic yet

  // Example chips fill the topic.
  await page.getByRole("button", { name: "Morning routine tips for remote teams", exact: true }).click();
  await expect(page.getByLabel("What's it about?")).toHaveValue("Morning routine tips for remote teams");
  const topic = `E2E studio topic ${Date.now()}`;
  await page.getByLabel("What's it about?").fill(topic);

  // Picking a video pulls in what it needs, and the preview says so.
  await page.getByRole("checkbox", { name: "Short video" }).click();
  await expect(page.getByRole("checkbox", { name: "Voiceover" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "Voiceover" })).toBeDisabled();
  await expect(page.getByText("Included — needed for video")).toBeVisible();
  await expect(page.getByText("5 agents run in order")).toBeVisible();

  // Auto-publish isn't available without a connected account.
  await expect(page.getByRole("checkbox", { name: "Auto-publish" })).toBeDisabled();

  // Tone preset toggles.
  await page.getByRole("button", { name: "Calm & minimal" }).click();
  await expect(page.getByLabel(/^Tone/)).toHaveValue("Calm & minimal");

  // Generate: the run opens on the right and is kept in the URL.
  await generate.click();
  await expect(page).toHaveURL(/\/studio\?run=/);
  await expect(page.getByRole("heading", { name: topic })).toBeVisible();
  await expect(page.getByText(/of 5 done/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Short video" })).toBeVisible();
  const runUrl = page.url();

  // The draft survives a reload; "New" returns to the empty results pane.
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByText("Your content will appear here")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("What's it about?")).toHaveValue(topic);

  // Recent creations reopens the run.
  await page.getByRole("button", { name: new RegExp(topic) }).click();
  await expect(page).toHaveURL(runUrl);
  await expect(page.getByRole("link", { name: "Open workflow" })).toHaveAttribute("href", /\/templates\/.+\/edit/);
});
