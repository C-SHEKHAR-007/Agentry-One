import { afterEach, describe, expect, it } from "vitest";
import { makeStore } from "../../../app/store";
import { baseApi } from "../../../services/api/baseApi";
import { fakeApi, tick } from "../../../test/fakeApi";
import { agentRunsApi } from "../agentRuns.api";

let restore = () => {};
afterEach(() => restore());

const run = (id: string) => ({ id, agentId: "echo-agent", agentName: "Echo", status: "completed", createdAt: "", updatedAt: "", project: { id: "p", name: "P" } });

describe("agent runs, a page at a time", () => {
  it("loads the next page with the cursor and stops when there is none", async () => {
    const api = fakeApi({
      "/workflows/recent?paged=1&limit=30": [200, { items: [run("w3"), run("w2")], nextCursor: "c1" }],
      "/workflows/recent?paged=1&limit=30&cursor=c1": [200, { items: [run("w1")], nextCursor: null }],
    });
    restore = api.restore;
    const store = makeStore();
    const sub = store.dispatch(agentRunsApi.endpoints.agentRunsPage.initiate({}));
    await sub;
    await store.dispatch(agentRunsApi.endpoints.agentRunsPage.initiate({}, { direction: "forward" }));
    const state = agentRunsApi.endpoints.agentRunsPage.select({})(store.getState());
    expect(state.data?.pages.flatMap((p) => p.items).map((w) => w.id)).toEqual(["w3", "w2", "w1"]);
    expect(state.hasNextPage).toBe(false);

    // Live activity (a tag invalidation) refreshes every loaded page.
    const before = api.calls.length;
    store.dispatch(baseApi.util.invalidateTags([{ type: "Workflow", id: "LIST" }]));
    await tick(30);
    expect(api.calls.slice(before)).toEqual(["GET /workflows/recent?paged=1&limit=30", "GET /workflows/recent?paged=1&limit=30&cursor=c1"]);
    sub.unsubscribe();
  });
});
