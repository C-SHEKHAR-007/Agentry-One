import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "../../../app/store";
import { fakeApi } from "../../../test/fakeApi";
import { socialAccountsApi } from "../socialAccounts.api";
import { useInstagramBrowserLogin } from "../hooks/useInstagramBrowserLogin";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

let restore = () => {};
afterEach(() => restore());
const B = "/integrations/instagram/browser-login";

function setup(routes: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi(routes);
  restore = api.restore;
  const store = makeStore();
  const onConnected = vi.fn();
  const hook = renderHook(() => useInstagramBrowserLogin({ projectId: "p1", enabled: true, onConnected }), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
  return { api, store, onConnected, ...hook };
}

describe("useInstagramBrowserLogin", () => {
  it("goes through the API (never the helper directly), polls, and refreshes the accounts on success", async () => {
    let polls = 0;
    const { api, store, onConnected, result } = setup({
      [`${B}/status`]: [200, { online: true, ready: true, session: "idle" }],
      [`POST ${B}/start`]: [200, { status: "in_progress" }],
      [`${B}/session`]: () => [200, ++polls < 2 ? { status: "in_progress", handle: null, error: null, elapsed: 3 } : { status: "success", handle: "@me", error: null, elapsed: 5 }],
      "/social-accounts?projectId=p1": [200, []],
    });
    const accounts = store.dispatch(socialAccountsApi.endpoints.socialAccounts.initiate("p1"));
    await accounts;
    await waitFor(() => expect(result.current.helperOnline).toBe(true));

    act(() => result.current.start());
    await waitFor(() => expect(onConnected).toHaveBeenCalled(), { timeout: 5000 });
    expect(result.current.loggingIn).toBe(false);
    expect(api.calls).toContain(`POST ${B}/start`);
    expect(api.calls.filter((c) => c === "GET /social-accounts?projectId=p1").length).toBe(2);
    expect(api.calls.every((c) => !c.includes("4005"))).toBe(true);
    accounts.unsubscribe();
  });

  it("reports the helper offline", async () => {
    const { result } = setup({ [`${B}/status`]: [200, { online: false, ready: false, session: "idle" }] });
    await waitFor(() => expect(result.current.helperOnline).toBe(false));
  });

  it("a start the helper can't take marks it offline and stops", async () => {
    const { result } = setup({
      [`${B}/status`]: [200, { online: true, ready: true, session: "idle" }],
      [`POST ${B}/start`]: [503, { error: "helper_offline", message: "The Instagram login helper isn't running." }],
    });
    await waitFor(() => expect(result.current.helperOnline).toBe(true));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.helperOnline).toBe(false));
    expect(result.current.loggingIn).toBe(false);
  });
});
