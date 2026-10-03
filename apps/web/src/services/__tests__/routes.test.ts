import { describe, expect, it } from "vitest";
import { routes } from "../api/routes";

describe("routes", () => {
  it("builds paths with encoded ids", () => {
    expect(routes.runs.detail("a/b")).toBe("/template-runs/a%2Fb");
    expect(routes.workflows.advance("wf1", "step one")).toBe("/workflows/wf1/steps/step%20one/advance");
  });

  it("adds only the query params that are set", () => {
    expect(routes.runs.list({ status: "active", limit: 4 })).toBe("/template-runs?status=active&limit=4");
    expect(routes.runs.list()).toBe("/template-runs");
    expect(routes.artifacts.list({ projectId: "", kind: "image" })).toBe("/artifacts?kind=image");
    expect(routes.workflows.recent({ limit: 12, status: undefined })).toBe("/workflows/recent?limit=12");
    expect(routes.providers.list()).toBe("/providers");
  });

  it("asks for a page, with the cursor once there is one", () => {
    expect(routes.runs.listPage({ status: "all", limit: 30 })).toBe("/template-runs?paged=1&limit=30&status=all");
    expect(routes.workflows.recentPage({ limit: 30, cursor: "abc=" })).toBe("/workflows/recent?paged=1&limit=30&cursor=abc%3D");
    expect(routes.artifacts.listPage({ limit: 48, cursor: null, kind: "image" })).toBe("/artifacts?paged=1&limit=48&kind=image");
  });

  it("gives absolute URLs for files and streams", () => {
    expect(routes.files.download("x")).toBe("/api/artifacts/x/download");
    expect(routes.files.attachment("x")).toBe("/api/artifacts/x/download?disposition=attachment");
    expect(routes.streams.job("j1")).toBe("/api/jobs/j1/events");
    expect(routes.streams.activity).toBe("/api/events/stream");
  });
});
