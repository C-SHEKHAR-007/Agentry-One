import { afterEach, describe, expect, it } from "vitest";
import { makeStore } from "../../../app/store";
import { fakeApi, tick } from "../../../test/fakeApi";
import { artifactsApi } from "../../artifacts/artifacts.api";
import { providersApi } from "../../providers/providers.api";
import { projectsApi } from "../projects.api";

let restore = () => {};
afterEach(() => restore());
const count = (calls: string[], key: string) => calls.filter((c) => c === key).length;

describe("projects cache", () => {
  it("creating a project refreshes the list", async () => {
    const api = fakeApi({ "/projects": [200, []], "POST /projects": [201, { id: "p2", name: "New" }] });
    restore = api.restore;
    const store = makeStore();
    const list = store.dispatch(projectsApi.endpoints.projects.initiate(undefined));
    await list;
    await store.dispatch(projectsApi.endpoints.createProject.initiate({ name: "New" }));
    await tick(20);
    expect(count(api.calls, "GET /projects")).toBe(2);
    list.unsubscribe();
  });

  it("deleting a project doesn't refetch it once the page has let go of it", async () => {
    const api = fakeApi({
      "/projects": [200, [{ id: "p1", name: "P" }]],
      "/projects/p1": [200, { id: "p1", name: "P" }],
      "DELETE /projects/p1": [204, undefined],
    });
    restore = api.restore;
    const store = makeStore();
    const list = store.dispatch(projectsApi.endpoints.projects.initiate(undefined));
    const detail = store.dispatch(projectsApi.endpoints.project.initiate("p1"));
    await Promise.all([list, detail]);
    detail.unsubscribe(); // ProjectPage skips its queries while deleting
    await store.dispatch(projectsApi.endpoints.deleteProject.initiate("p1"));
    await tick(20);
    expect(count(api.calls, "GET /projects/p1")).toBe(1);
    expect(count(api.calls, "GET /projects")).toBe(2);
    list.unsubscribe();
  });
});

describe("providers and artifacts", () => {
  it("lists providers for one capability", async () => {
    const api = fakeApi({ "/providers?capability=text-generation": [200, [{ id: "c1", status: "active" }]] });
    restore = api.restore;
    const store = makeStore();
    const res = await store.dispatch(providersApi.endpoints.providers.initiate("text-generation"));
    expect(res.data?.[0].id).toBe("c1");
  });

  it("reads a text artifact's contents as a string", async () => {
    const api = fakeApi({ "/artifacts/a1/download": [200, "Caption: hello"] });
    restore = api.restore;
    const store = makeStore();
    const res = await store.dispatch(artifactsApi.endpoints.artifactText.initiate("a1"));
    expect(res.data).toBe("Caption: hello");
  });
});
