import { afterEach, describe, expect, it } from "vitest";
import { makeStore } from "../../../app/store";
import { fakeApi, tick } from "../../../test/fakeApi";
import { templatesApi } from "../templates.api";

let restore = () => {};
afterEach(() => restore());
const count = (calls: string[], key: string) => calls.filter((c) => c === key).length;

const summary = { id: "t1", name: "Launch", description: null, project: { id: "p1", name: "P" }, steps: [], runs: [], schedules: [], runCount: 0, status: "draft", createdAt: "", updatedAt: "" };

describe("workflows cache", () => {
  it("duplicate copies the steps into a new workflow and refreshes the library", async () => {
    let posted: unknown;
    const api = fakeApi({
      "/templates": [200, [summary]],
      "/templates/t1": [200, { id: "t1", projectId: "p1", name: "Launch", steps: [{ stepOrder: 0, agentId: "echo-agent", agentStepKey: "run", inputMapping: {}, id: "s1", snapshot: 1 }] }],
      "POST /projects/p1/templates": () => [201, { id: "t2", projectId: "p1", name: "Copy of Launch", steps: [] }],
    });
    restore = api.restore;
    const store = makeStore();
    const lib = store.dispatch(templatesApi.endpoints.workflowLibrary.initiate(undefined));
    await lib;
    const res = await store.dispatch(templatesApi.endpoints.duplicateTemplate.initiate(summary as never));
    expect("data" in res && res.data?.id).toBe("t2");
    await tick(20);
    expect(api.calls).toContain("POST /projects/p1/templates");
    expect(count(api.calls, "GET /templates")).toBe(2);
    lib.unsubscribe();
    void posted;
  });

  it("saving writes the response into the editor's cache instead of refetching it", async () => {
    const api = fakeApi({
      "/templates/t1": [200, { id: "t1", projectId: "p1", name: "Old", steps: [] }],
      "PUT /templates/t1": [200, { id: "t1", projectId: "p1", name: "New", steps: [] }],
    });
    restore = api.restore;
    const store = makeStore();
    const sub = store.dispatch(templatesApi.endpoints.template.initiate("t1"));
    await sub;
    await store.dispatch(templatesApi.endpoints.updateTemplate.initiate({ id: "t1", body: { name: "New", steps: [] } }));
    await tick(20);
    expect(count(api.calls, "GET /templates/t1")).toBe(1);
    expect(templatesApi.endpoints.template.select("t1")(store.getState()).data?.name).toBe("New");
    sub.unsubscribe();
  });
});
