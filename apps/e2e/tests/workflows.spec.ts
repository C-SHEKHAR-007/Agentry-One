import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("workflow library: list, search, filter, schedule badge, duplicate, delete", async ({ page }) => {
  const stamp = Date.now();
  const name = `E2E Library ${stamp}`;

  // Seed a project with one scheduled, two-step workflow (as the signed-in user).
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Library Project ${stamp}` } })).json();
  const created = await page.request.post(`/api/projects/${project.id}/templates`, {
    data: {
      name,
      steps: [
        { stepOrder: 0, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromRunInput", field: "greeting" } } },
        { stepOrder: 1, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } } },
      ],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const template = await created.json();
  const sched = await page.request.post(`/api/templates/${template.id}/schedule`, { data: { cronExpr: "0 9 * * 1", runInputs: {} } });
  expect(sched.status(), await sched.text()).toBe(201);

  await page.goto("/builder");
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();

  // Search narrows to our card, which shows the summary.
  await page.getByLabel("Search workflows").fill(name);
  const card = page.locator("div", { has: page.getByRole("heading", { name }) }).filter({ has: page.getByRole("link", { name: "Run" }) }).last();
  await expect(card.getByText("2 steps · Echo Agent → Echo Agent")).toBeVisible();
  await expect(card.getByText("Asks for greeting")).toBeVisible();
  await expect(card.getByText("Mon at 09:00")).toBeVisible();
  await expect(card.getByText("Never run")).toBeVisible();
  await expect(card.getByRole("link", { name: "Run" })).toHaveAttribute("href", `/templates/${template.id}/run`);

  // Project filter is reflected in the URL.
  await page.getByLabel("Filter by project").selectOption(project.id);
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Duplicate via the card menu.
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page.getByRole("heading", { name: `Copy of ${name}` })).toBeVisible();

  // Delete the copy, with confirmation.
  await page.getByRole("button", { name: `Actions for Copy of ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("can't be undone")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  // The page is aria-hidden while the dialog is open, so wait for it to close
  // before asserting on the list.
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: `Copy of ${name}` })).toHaveCount(0);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // No-match state.
  await page.getByLabel("Search workflows").fill("definitely-no-such-workflow-xyz");
  await expect(page.getByText("No workflows match")).toBeVisible();
});
