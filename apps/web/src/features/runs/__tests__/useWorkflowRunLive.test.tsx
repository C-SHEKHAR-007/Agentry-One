import { afterEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "../../../app/store";
import { fakeApi } from "../../../test/fakeApi";
import { useWorkflowRunLive } from "../runs.api";

let restore = () => {};
afterEach(() => restore());

describe("useWorkflowRunLive", () => {
  it("shows no run once the run is cleared (RTK Query would keep the last one)", async () => {
    const api = fakeApi({ "/template-runs/r1": [200, { id: "r1", status: "completed", steps: [] }] });
    restore = api.restore;
    const store = makeStore();
    const { result, rerender } = renderHook(({ id }: { id: string | undefined }) => useWorkflowRunLive(id), {
      initialProps: { id: "r1" as string | undefined },
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await waitFor(() => expect(result.current.data?.id).toBe("r1"));
    rerender({ id: undefined });
    expect(result.current.data).toBeUndefined();
  });

  it("stops polling once the run has settled", async () => {
    const api = fakeApi({ "/template-runs/r2": [200, { id: "r2", status: "completed", steps: [] }] });
    restore = api.restore;
    const store = makeStore();
    renderHook(() => useWorkflowRunLive("r2", 50), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> });
    await new Promise((r) => setTimeout(r, 400));
    // First fetch, possibly one poll before the status was known -- never a stream of polls.
    expect(api.calls.filter((c) => c === "GET /template-runs/r2").length).toBeLessThanOrEqual(2);
  });
});
