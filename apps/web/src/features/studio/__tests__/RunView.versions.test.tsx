import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { makeStore } from "../../../app/store";
import { fakeApi } from "../../../test/fakeApi";
import type { RunDetail } from "../../../models";
import { RunView } from "../components/RunView";

const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: null };
const runStep = (id: string, stepOrder: number, agentId: string, workflowId: string, inputMapping: Record<string, unknown>) => ({
  id,
  status: "completed",
  workflowId,
  reusedFromStepId: null,
  createdAt: "2026-10-18T10:00:00Z",
  updatedAt: "2026-10-18T10:00:00Z",
  templateStep: { id: `ts-${id}`, stepOrder, agentId, agentStepKey: "run", inputMapping },
  workflow: { id: workflowId, status: "completed", agentId, agentName: agentId, createdAt: "2026-10-18T10:00:00Z" },
  usage,
});

const run = (versions: RunDetail["versions"]): RunDetail =>
  ({
    id: "r2",
    templateId: "t1",
    status: "completed",
    runInputs: { topic: "Autumn sale" },
    createdAt: "2026-10-18T10:00:00Z",
    updatedAt: "2026-10-18T10:06:00Z",
    template: { id: "t1", name: "Studio", projectId: "p1" },
    steps: [runStep("cap", 0, "content-brief-writer", "w-cap2", { prompt: { kind: "fromRunInput", field: "topic" } })],
    totals: usage,
    versions,
  }) as unknown as RunDetail;

const text = (id: string, wf: string) => [{ id, workflowId: wf, kind: "text", mimeType: "text/plain" }];

let restore = () => {};
afterEach(() => restore());

function renderRun(r: RunDetail, extra: Record<string, [number, unknown]> = {}) {
  const api = fakeApi({
    "/workflows/w-cap1/artifacts": [200, text("a1", "w-cap1")],
    "/workflows/w-cap2/artifacts": [200, text("a2", "w-cap2")],
    "/artifacts/a1/download": [200, "First caption"],
    "/artifacts/a2/download": [200, "Second caption"],
    ...extra,
  });
  restore = api.restore;
  const onOpen = vi.fn();
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <RunView run={r} projectId="p1" accounts={[]} onNew={() => {}} onOpen={onOpen} />
      </MemoryRouter>
    </Provider>,
  );
  return { api, onOpen };
}

const twoVersions = {
  "ts-cap": [
    { workflowId: "w-cap1", runId: "r1", createdAt: "2026-10-18T10:00:00Z" },
    { workflowId: "w-cap2", runId: "r2", createdAt: "2026-10-18T10:05:00Z" },
  ],
};

describe("Studio versions, regenerate and variants", () => {
  it("switches the caption between its versions", async () => {
    renderRun(run(twoVersions));
    expect(await screen.findByText("Second caption")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "v2" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "v1" }));
    expect(await screen.findByText("First caption")).toBeInTheDocument();
  });

  it("regenerates only the caption, with a note, and opens the new run", async () => {
    const { api, onOpen } = renderRun(run(twoVersions), { "POST /template-runs/r2/retry": [201, { id: "r3" }] });
    await screen.findByText("Second caption");
    await userEvent.click(screen.getByRole("button", { name: /Regenerate/ }));
    await userEvent.type(screen.getByLabelText("Note for the new caption"), "shorter");
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith("r3"));
    expect(api.bodies["POST /template-runs/r2/retry"]).toEqual({ fromStepOrder: 0, onlyStep: true, note: "shorter" });
  });

  it("tops the caption up to three variants", async () => {
    const { api } = renderRun(run(twoVersions), { "POST /template-runs/r2/variants": [201, [{ id: "r4" }]] });
    await screen.findByText("Second caption");
    await userEvent.click(screen.getByRole("button", { name: /3 variants/ }));
    await waitFor(() => expect(api.calls).toContain("POST /template-runs/r2/variants"));
    // Two versions exist, so one more makes three.
    expect(api.bodies["POST /template-runs/r2/variants"]).toEqual({ stepOrder: 0, count: 1 });
  });

  it("shows no version chips for a single version", async () => {
    renderRun(run({ "ts-cap": [twoVersions["ts-cap"][1]] }));
    await screen.findByText("Second caption");
    expect(screen.queryByRole("button", { name: "v1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3 variants/ })).toBeInTheDocument();
  });
});
