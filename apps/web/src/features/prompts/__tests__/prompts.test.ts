import { afterEach, describe, expect, it } from "vitest";
import { makeStore } from "../../../app/store";
import { fakeApi, tick } from "../../../test/fakeApi";
import { groupPrompts } from "../grouping";
import { promptsApi } from "../prompts.api";

let restore = () => {};
afterEach(() => restore());
const count = (calls: string[], key: string) => calls.filter((c) => c === key).length;

const p = (id: string, key: string, version: number, template = "Hi {{name}}") => ({ id, agentId: "a1", key, version, template, createdAt: `2026-01-0${version}` });

describe("groupPrompts", () => {
  it("groups versions by agent + key, newest first, with the latest's placeholders", () => {
    const groups = groupPrompts([p("1", "hello", 1, "Hi"), p("2", "hello", 2, "Hi {{name}} from {{city}}"), p("3", "bye", 1)]);
    const hello = groups.find((g) => g.key === "hello")!;
    expect(groups).toHaveLength(2);
    expect(hello.id).toBe("a1:hello");
    expect(hello.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(hello.latest.id).toBe("2");
    expect(hello.placeholders).toEqual(["name", "city"]);
  });
});

describe("prompts cache", () => {
  it("saving a prompt refreshes both the library and an agent's list", async () => {
    const api = fakeApi({
      "/prompts": [200, [p("1", "hello", 1)]],
      "/prompts?agentId=a1": [200, [p("1", "hello", 1)]],
      "POST /prompts": [201, p("2", "hello", 2)],
    });
    restore = api.restore;
    const store = makeStore();
    const all = store.dispatch(promptsApi.endpoints.prompts.initiate(undefined));
    const forAgent = store.dispatch(promptsApi.endpoints.prompts.initiate("a1"));
    await Promise.all([all, forAgent]);
    await store.dispatch(promptsApi.endpoints.createPrompt.initiate({ agentId: "a1", key: "hello", template: "x" }));
    await tick(20);
    expect(count(api.calls, "GET /prompts")).toBe(2);
    expect(count(api.calls, "GET /prompts?agentId=a1")).toBe(2);
    all.unsubscribe();
    forAgent.unsubscribe();
  });

  it("deleting a version refreshes the list", async () => {
    const api = fakeApi({ "/prompts": [200, [p("1", "hello", 1)]], "DELETE /prompts/1": [204, undefined] });
    restore = api.restore;
    const store = makeStore();
    const all = store.dispatch(promptsApi.endpoints.prompts.initiate(undefined));
    await all;
    const res = await store.dispatch(promptsApi.endpoints.deletePrompt.initiate("1"));
    expect("error" in res).toBe(false);
    await tick(20);
    expect(count(api.calls, "GET /prompts")).toBe(2);
    all.unsubscribe();
  });
});
