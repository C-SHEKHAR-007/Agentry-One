import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { makeStore } from "../../../app/store";
import { fakeApi } from "../../../test/fakeApi";
import { localTimezone } from "../../../lib/cron";
import { TemplateRunPage } from "../pages/TemplateRunPage";

const template = {
  id: "t1",
  projectId: "p1",
  name: "Launch kit",
  steps: [
    { stepOrder: 0, agentId: "dynamic", agentStepKey: "run", inputMapping: { prompt: { kind: "fromRunInput", field: "topic" } } },
    {
      stepOrder: 1,
      agentId: "sketch-agent",
      agentStepKey: "generate",
      inputMapping: { prompt: { kind: "fromRunInput", field: "topic" }, steps: { kind: "fromRunInput", field: "quality" } },
    },
  ],
};

const agent = (id: string, name: string, key: string, properties: Record<string, unknown>) => ({
  id,
  name,
  manifest: { steps: [{ key, producesArtifactKinds: [], inputSchema: { properties, required: ["prompt"] } }] },
});

let restore = () => {};
afterEach(() => restore());

function renderPage(extra: Record<string, [number, unknown] | (() => [number, unknown])> = {}) {
  const api = fakeApi({
    "/templates/t1": [200, template],
    "/templates/t1/schedules": [200, [{ id: "s1", cronExpr: "0 9 * * 2", timezone: null, isActive: true, createdAt: "" }]],
    "/agents/dynamic": [200, agent("dynamic", "Text Writer", "run", { prompt: { type: "string", title: "Prompt" } })],
    "/agents/sketch-agent": [
      200,
      agent("sketch-agent", "Sketch Agent", "generate", {
        prompt: { type: "string", title: "Prompt" },
        steps: { type: "integer", title: "Inference steps", minimum: 1, maximum: 4 },
      }),
    ],
    "/social-accounts?projectId=p1": [200, []],
    ...extra,
  });
  restore = api.restore;
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={["/templates/t1/run"]}>
        <Routes>
          <Route path="/templates/:templateId/run" element={<TemplateRunPage />} />
          <Route path="/template-runs/:id" element={<p>run view</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return api;
}

describe("TemplateRunPage", () => {
  it("groups run inputs by the step that uses them, titled from the agent schema", async () => {
    renderPage();
    expect(await screen.findByText("Text Writer")).toBeInTheDocument();
    expect(await screen.findByText("Sketch Agent")).toBeInTheDocument();
    // "topic" shows once, under step 1, and says step 2 also reads it.
    expect(screen.getAllByLabelText(/Prompt/)).toHaveLength(1);
    expect(screen.getByText("Also used by step 2")).toBeInTheDocument();
    expect(await screen.findByLabelText(/Inference steps/)).toHaveAttribute("type", "number");
  });

  it("sends numbers as numbers", async () => {
    const api = renderPage({ "POST /templates/t1/run": [201, { id: "r1" }] });
    await userEvent.type(await screen.findByLabelText(/Prompt/), "a fox");
    await userEvent.type(await screen.findByLabelText(/Inference steps/), "3");
    await userEvent.click(screen.getByRole("button", { name: /Run now/ }));
    expect(await screen.findByText("run view")).toBeInTheDocument();
    expect(api.bodies["POST /templates/t1/run"]).toEqual({ topic: "a fox", quality: 3 });
  });

  it("builds the schedule with the picker and saves it with the browser's timezone", async () => {
    const api = renderPage({ "POST /templates/t1/schedule": [201, { id: "s2", cronExpr: "30 17 * * 1,5" }] });
    await screen.findByText("Text Writer");
    // The existing schedule reads as text, with the timezone it runs in.
    const active = screen.getByText("Active schedules").parentElement!;
    expect(within(active).getByText("Tue at 09:00")).toBeInTheDocument();
    expect(within(active).getByText(/server time/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Repeat"), "weekly");
    await userEvent.click(screen.getByRole("button", { name: "Tue" })); // off
    await userEvent.click(screen.getByRole("button", { name: "Mon" }));
    await userEvent.click(screen.getByRole("button", { name: "Fri" }));
    // A browser's time input reports whole values, never partial typing.
    fireEvent.change(screen.getByLabelText("At"), { target: { value: "17:30" } });
    expect(screen.getByTestId("next-runs").textContent).toMatch(/^Next: /);

    await userEvent.click(screen.getByRole("button", { name: /Set schedule/ }));
    await waitFor(() => expect(api.calls).toContain("POST /templates/t1/schedule"));
    expect(api.bodies["POST /templates/t1/schedule"]).toEqual({ cronExpr: "30 17 * * 1,5", timezone: localTimezone(), runInputs: {} });
  });

  it("falls back to a raw expression for custom schedules and flags bad ones", async () => {
    renderPage();
    await screen.findByText("Text Writer");
    await userEvent.selectOptions(screen.getByLabelText("Repeat"), "custom");
    const box = screen.getByLabelText("Cron expression");
    await userEvent.clear(box);
    await userEvent.type(box, "not cron");
    expect(screen.getByText(/never runs, or isn't valid/)).toBeInTheDocument();
  });
});
