import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

/** A two-step workflow (echo → echo, the second reading the first's text)
 * and one run of it. With a worker the run completes; without one it stays
 * queued -- every assertion below holds either way. */
async function startWorkflowRun(page: Page) {
  const project = await (await page.request.post("/api/projects", { data: { name: `E2E Orchestration ${Date.now()}` } })).json();
  const name = `E2E Graph ${Date.now()}`;
  const tpl = await page.request.post(`/api/projects/${project.id}/templates`, {
    data: {
      name,
      steps: [
        { stepOrder: 0, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromRunInput", field: "topic" } } },
        { stepOrder: 1, agentId: "echo-agent", agentStepKey: "run", inputMapping: { message: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } } },
      ],
    },
  });
  expect(tpl.status(), await tpl.text()).toBe(201);
  const template = await tpl.json();
  const started = await page.request.post(`/api/templates/${template.id}/run`, { data: { topic: "graph e2e topic" } });
  expect(started.status(), await started.text()).toBe(201);
  const run = await started.json();
  return { project, template, run, name };
}

test("dashboard: control-center hero, live panels and usage tabs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/");
  await expect(page.getByText("AI control center")).toBeVisible();
  await expect(page.getByText(/Your orchestration system|Core services|Checking your orchestration/)).toBeVisible();
  await expect(page.getByText("Active runs", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Live activity", { exact: true })).toBeVisible();

  // Usage bars switch metric.
  await page.getByRole("tab", { name: "Tokens" }).click();
  await expect(page.getByRole("tab", { name: "Tokens" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Latency" }).click();
  await expect(page.getByRole("tab", { name: "Latency" })).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("runs: renamed page, legacy links redirect, workflow and agent tabs", async ({ page }) => {
  const { name } = await startWorkflowRun(page);

  await page.goto("/executions?status=completed");
  await expect(page).toHaveURL(/\/runs\?status=completed$/);
  await expect(page.getByRole("heading", { name: "Runs", exact: true })).toBeVisible();
  // A status filter from an old link lands on agent runs.
  await expect(page.getByRole("tab", { name: /Agent runs/ })).toHaveAttribute("aria-selected", "true");

  await page.goto("/runs");
  await expect(page.getByRole("tab", { name: /Workflow runs/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name }).first().click();
  await expect(page).toHaveURL(/\/template-runs\/[0-9a-f-]{36}$/);
});

test("workflow run page: live graph, inspector, logs, inputs", async ({ page }) => {
  const { run, name, template } = await startWorkflowRun(page);
  await page.goto(`/template-runs/${run.id}`);

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/^RUN_[0-9A-F]{6}$/)).toBeVisible();
  // Totals strip.
  for (const label of ["Steps", "Tokens", "Cost"]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();

  // Both steps are drawn, with the data-flow edge between them.
  const graph = page.locator(".react-flow");
  await expect(graph.getByText("Step 1", { exact: true })).toBeVisible();
  await expect(graph.getByText("Step 2", { exact: true })).toBeVisible();
  await expect(graph.locator(".react-flow__edge")).not.toHaveCount(0);

  // Selecting a step opens it in the inspector with its telemetry and logs.
  await graph.getByText("Step 1", { exact: true }).click();
  // "Latency" once finished, "Elapsed" while running (no worker picks it up).
  const inspector = page.locator("div", { has: page.getByRole("heading", { level: 2 }) }).filter({ hasText: /Latency|Elapsed/ }).last();
  await expect(inspector.getByText("Step 1", { exact: true })).toBeVisible();
  for (const label of ["Model", "Attempts", "Input", "Output"]) await expect(inspector.getByText(label, { exact: true })).toBeVisible();
  await expect(inspector.getByText(/^(Latency|Elapsed)$/)).toBeVisible();
  await expect(inspector.getByText("Logs", { exact: true })).toBeVisible();

  // Inputs view shows what the run was started with; the URL keeps the view.
  await page.getByRole("tab", { name: "Inputs" }).click();
  await expect(page).toHaveURL(/view=inputs/);
  await expect(page.getByText("graph e2e topic")).toBeVisible();

  await page.getByRole("tab", { name: "Steps" }).click();
  await expect(page.getByText("Step", { exact: false }).first()).toBeVisible();

  // Header actions.
  await expect(page.getByRole("link", { name: "Edit workflow" })).toHaveAttribute("href", `/templates/${template.id}/edit`);
  await expect(page.getByRole("link", { name: "Run again" })).toHaveAttribute("href", `/templates/${template.id}/run`);

  // Leave nothing running behind.
  const cancel = page.getByRole("button", { name: "Cancel" });
  if (await cancel.isVisible()) await cancel.click();
});

test("command palette: actions, workflows and runs by id", async ({ page }) => {
  const { name, run } = await startWorkflowRun(page);
  await page.goto("/");
  // Wait for the app shell (the shortcut listener lives in it), then ⌘K/Ctrl+K.
  await expect(page.getByRole("button", { name: /^Account menu/ })).toBeVisible();
  await page.keyboard.press("Control+k");
  const input = page.getByRole("textbox", { name: "Search agents, workflows, runs" });
  await expect(input).toBeVisible();
  // Empty query: actions first.
  await expect(page.getByRole("button", { name: /Create workflow/ })).toBeVisible();

  // Search a workflow by name and open it in the editor.
  await input.fill(name);
  await expect(page.getByRole("button", { name: new RegExp(name) }).first()).toBeVisible();

  // Search a run by its short code.
  const code = `RUN_${run.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
  await input.fill(code);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/template-runs/${run.id}$`));
});

test("dashboard updates live when a run starts (pushed, not polled)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AI control center")).toBeVisible();
  await page.waitForTimeout(1000); // let the activity stream connect

  // Nothing happening: no polling for a few seconds. (A busy worker records
  // real events, which correctly trigger refreshes -- only assert silence
  // when no event was recorded in the window.)
  const latestEvent = async () => ((await (await page.request.get("/api/events?limit=1")).json()) as Array<{ id: string }>)[0]?.id;
  const before = await latestEvent();
  const requests: string[] = [];
  const onRequest = (r: { url(): string }) => r.url().includes("/api/") && requests.push(new URL(r.url()).pathname);
  page.on("request", onRequest);
  await page.waitForTimeout(4000);
  page.off("request", onRequest);
  if ((await latestEvent()) === before) expect(requests.filter((p) => !p.endsWith("/stream"))).toEqual([]);

  // A run started elsewhere makes the page refetch within seconds. Polling
  // fallbacks are minutes long, so this can only come from the pushed signal.
  // (Checked by request, not by the row: with a live worker a two-step echo
  // run can finish before the panel redraws.)
  const refetched = page.waitForRequest((r) => r.url().includes("/api/template-runs?status=active"), { timeout: 5000 });
  const { name } = await startWorkflowRun(page);
  await refetched;
  await expect(page.getByText(name).or(page.getByText("Run queued")).first()).toBeVisible({ timeout: 5000 });
});
