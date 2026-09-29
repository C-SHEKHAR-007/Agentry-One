import { beforeEach, describe, expect, it } from "vitest";
import { loadUiState, persistUi, resizeSidebar, setTheme, toggleSidebar, uiReducer, THEME_KEY, SIDEBAR_WIDTH_KEY } from "../ui.slice";

beforeEach(() => localStorage.clear());

describe("ui slice: persisted preferences", () => {
  it("reads the pre-v2.2 localStorage keys, including the legacy sidebar key", () => {
    localStorage.setItem(THEME_KEY, "light");
    localStorage.setItem("agentry-sidebar", "collapsed");
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "310");
    const s = loadUiState("");
    expect(s.theme).toBe("light");
    expect(s.sidebar).toEqual({ collapsed: true, width: 310, lastWidth: 310 });
  });

  it("clamps widths and ignores corrupt values", () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "9999");
    localStorage.setItem("agentry-sidebar-collapsed", "not-json");
    localStorage.setItem(THEME_KEY, "purple");
    const s = loadUiState("");
    expect(s.sidebar.width).toBe(400);
    expect(s.sidebar.collapsed).toBe(false);
    expect(s.theme).toBe("dark");
  });

  it("?theme= forces a theme for this load without persisting it, until the user chooses", () => {
    localStorage.setItem(THEME_KEY, "dark");
    let s = loadUiState("?theme=light");
    expect(s).toMatchObject({ theme: "light", persistTheme: false });
    persistUi(s);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    s = uiReducer(s, setTheme("system"));
    persistUi(s);
    expect(localStorage.getItem(THEME_KEY)).toBe("system");
  });

  it("collapsing remembers the width and expanding restores it", () => {
    let s = uiReducer(loadUiState(""), resizeSidebar(300));
    s = uiReducer(s, toggleSidebar());
    expect(s.sidebar).toMatchObject({ collapsed: true, lastWidth: 300 });
    s = uiReducer(s, toggleSidebar());
    expect(s.sidebar).toMatchObject({ collapsed: false, width: 300 });
  });
});
