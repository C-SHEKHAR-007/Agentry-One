import { afterEach, describe, expect, it } from "vitest";
import { makeStore } from "../../../app/store";
import { fakeApi, tick } from "../../../test/fakeApi";
import { agentRunsApi } from "../agentRuns.api";
import { runsApi } from "../runs.api";

let restore = () => {};
afterEach(() => restore());

const count = (calls: string[], key: string) => calls.filter((c) => c === key).length;

describe("runs cache", () => {
  it("cancelling an agent run refetches that run, the runs lists, and nothing else", async () => {
    const api = fakeApi({
      "/workflows/w1": [200, { id: "w1", status: "running", steps: [] }],
      "/workflows/w2": [200, { id: "w2", status: "running", steps: [] }],
      "/workflows/recent?limit=6": [200, [{ id: "w1" }]],
      "/template-runs?status=active&limit=4": [200, []],
      "POST /workflows/w1/cancel": [200, {}],
    });
    restore = api.restore;
    const store = makeStore();
    const subs = [
      store.dispatch(agentRunsApi.endpoints.agentRun.initiate("w1")),
      store.dispatch(agentRunsApi.endpoints.agentRun.initiate("w2")),
      store.dispatch(agentRunsApi.endpoints.recentAgentRuns.initiate({ limit: 6 })),
      store.dispatch(runsApi.endpoints.workflowRuns.initiate({ status: "active", limit: 4 })),
    ];
    await Promise.all(subs);
    await store.dispatch(agentRunsApi.endpoints.cancelAgentRun.initiate("w1"));
    await tick(20);
    expect(count(api.calls, "GET /workflows/w1")).toBe(2);
    expect(count(api.calls, "GET /workflows/w2")).toBe(1);
    expect(count(api.calls, "GET /workflows/recent?limit=6")).toBe(2);
    expect(count(api.calls, "GET /template-runs?status=active&limit=4")).toBe(2);
    subs.forEach((s) => s.unsubscribe());
  });

  it("one /workflows/:id cache entry, however many components read it", async () => {
    const api = fakeApi({ "/workflows/w1": [200, { id: "w1", status: "completed", steps: [] }] });
    restore = api.restore;
    const store = makeStore();
    const a = store.dispatch(agentRunsApi.endpoints.agentRun.initiate("w1"));
    const b = store.dispatch(agentRunsApi.endpoints.agentRun.initiate("w1"));
    await Promise.all([a, b]);
    expect(count(api.calls, "GET /workflows/w1")).toBe(1);
    a.unsubscribe();
    b.unsubscribe();
  });
});
