import { expect, test, type Page } from "@playwright/test";

/** Creates a project with a two-step echo workflow through the API (as the
 * signed-in user) and returns the template id. */
async function seedWorkflow(page: Page): Promise<string> {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Workflow ${Date.now()}` } })).json();
  const res = await page.request.post(`/api/projects/${project.id}/templates`, {
    data: {
      name: "E2E echo chain",
      steps: [
        { stepOrder: 0, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromRunInput", field: "greeting" } } },
        {
          stepOrder: 1,
          agentId: "echo-agent",
          agentStepKey: "run",
          inputMapping: { message: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } },
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).id;
}

test.use({ viewport: { width: 1440, height: 900 } });

test("workflow editor: canvas, step sidebar, edit, validate, save, form view", async ({ page }) => {
  const templateId = await seedWorkflow(page);
  await page.goto(`/templates/${templateId}/edit`);

  // Full workflow on the canvas: run inputs + both steps, one step→step edge.
  await expect(page.getByLabel("Workflow name")).toHaveValue("E2E echo chain");
  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect(page.locator(".react-flow__node-step")).toHaveCount(2);
  await expect(page.locator(".react-flow__node-inputs").getByText("greeting")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2); // run inputs → step 1, step 1 → step 2

  // Clicking a step opens it alone in the sidebar; walk with previous/next.
  await page.locator('[data-id="step-1"]').click();
  const panel = page.getByRole("complementary", { name: "Edit step 2" });
  await expect(panel.getByText("Step 2 of 2")).toBeVisible();
  await expect(panel.getByRole("radiogroup", { name: "Source for message" }).getByRole("radio", { name: "Earlier step" })).toHaveAttribute("aria-checked", "true");
  await panel.getByRole("button", { name: "Previous step" }).click();
  const panel1 = page.getByRole("complementary", { name: "Edit step 1" });
  await expect(panel1.getByText("Step 1 of 2")).toBeVisible();
  // Step 1 has nothing earlier to read from.
  await expect(panel1.getByRole("radiogroup", { name: "Source for message" }).getByRole("radio", { name: "Earlier step" })).toBeDisabled();

  // Edit: switch step 1's message to a fixed value -> unsaved state, Run blocked.
  await panel1.getByRole("radiogroup", { name: "Source for message" }).getByRole("radio", { name: "Fixed value" }).click();
  await panel1.locator("#field-0-message").fill("hello from the canvas");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); // close sidebar (focus leaves the field first)
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 400 } });
  await expect(page.getByRole("complementary", { name: /^Edit step/ })).toHaveCount(0);

  // Add a third step: it opens straight into the sidebar.
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  const panel3 = page.getByRole("complementary", { name: "Edit step 3" });
  await expect(panel3.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByText(/problem.* to fix/)).toBeVisible(); // no agent chosen yet
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await panel3.getByLabel("Agent").selectOption("echo-agent");
  // Read step 2's text output.
  await panel3.getByRole("radiogroup", { name: "Source for message" }).getByRole("radio", { name: "Earlier step" }).click();
  await expect(panel3.getByLabel("Source step")).toHaveValue("1");
  await expect(page.locator(".react-flow__node-step")).toHaveCount(3);

  // Save persists everything.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();
  await page.reload();
  await expect(page.locator(".react-flow__node-step")).toHaveCount(3);

  // Remove step 3 (with confirmation) from the sidebar. With a live worker,
  // other tests' failing jobs raise toasts over the sidebar's corner; they're
  // not what this test is about, so keep them out of the way.
  await page.addStyleTag({ content: 'section[aria-label^="Notifications"] { display: none !important; }' });
  await page.locator('[data-id="step-2"]').click();
  await page.getByRole("button", { name: "Remove step" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator(".react-flow__node-step")).toHaveCount(2);
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  // Form view shows the same draft.
  await page.getByRole("tab", { name: "Form" }).click();
  await expect(page).toHaveURL(/view=form/);
  await expect(page.getByRole("button", { name: /^Step 2 Echo Agent/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Step 3 / })).toHaveCount(0);
  await expect(page.locator("#field-0-message")).toHaveValue("hello from the canvas");
});
