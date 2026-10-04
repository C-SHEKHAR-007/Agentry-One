import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { parseJson, readStored, writeStored } from "../../app/persistence";

export type Theme = "light" | "dark" | "system";

// Same localStorage keys as before v2.2, so existing preferences survive.
export const THEME_KEY = "agentry-theme";
export const SIDEBAR_COLLAPSED_KEY = "agentry-sidebar-collapsed";
export const SIDEBAR_WIDTH_KEY = "agentry-sidebar-width";
export const SIDEBAR_LAST_WIDTH_KEY = "agentry-sidebar-last-width";
const LEGACY_SIDEBAR_KEY = "agentry-sidebar";

export const SIDEBAR = { default: 240, min: 190, max: 400 } as const;
const clampWidth = (n: number) => Math.min(Math.max(n, SIDEBAR.min), SIDEBAR.max);

export interface UiState {
  theme: Theme;
  /** False while a ?theme= override is in effect and the user hasn't chosen. */
  persistTheme: boolean;
  sidebar: { collapsed: boolean; width: number; lastWidth: number };
  paletteOpen: boolean;
  mobileNavOpen: boolean;
}

const asWidth = (raw: string) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : clampWidth(n);
};

/** Reads persisted preferences. ?theme=light|dark forces a theme for this
 * load (mirrors index.html's pre-paint script) without persisting it. */
export function loadUiState(search = typeof window !== "undefined" ? window.location.search : ""): UiState {
  const override = new URLSearchParams(search).get("theme");
  const stored = readStored<Theme>(THEME_KEY, (r) => (r === "light" || r === "dark" || r === "system" ? r : undefined), "dark");
  const legacyCollapsed = readStored(LEGACY_SIDEBAR_KEY, (r) => r === "collapsed", false);
  const width = readStored(SIDEBAR_WIDTH_KEY, asWidth, SIDEBAR.default);
  return {
    theme: override === "light" || override === "dark" ? override : stored,
    persistTheme: !(override === "light" || override === "dark"),
    sidebar: {
      collapsed: readStored(SIDEBAR_COLLAPSED_KEY, (r) => parseJson<boolean>(r), legacyCollapsed),
      width,
      lastWidth: readStored(SIDEBAR_LAST_WIDTH_KEY, asWidth, width),
    },
    paletteOpen: false,
    mobileNavOpen: false,
  };
}

const uiSlice = createSlice({
  name: "ui",
  initialState: loadUiState,
  reducers: {
    /** An explicit choice always persists, even after a ?theme= override. */
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      state.persistTheme = true;
    },
    toggleSidebar(state) {
      const s = state.sidebar;
      if (s.collapsed) {
        // Expanding restores the width it had before collapsing.
        s.width = s.lastWidth >= SIDEBAR.min ? s.lastWidth : SIDEBAR.default;
        s.collapsed = false;
      } else {
        s.lastWidth = s.width;
        s.collapsed = true;
      }
    },
    resizeSidebar(state, action: PayloadAction<number>) {
      state.sidebar.width = clampWidth(action.payload);
      state.sidebar.lastWidth = state.sidebar.width;
    },
    resetSidebarWidth(state) {
      state.sidebar.width = SIDEBAR.default;
      state.sidebar.lastWidth = SIDEBAR.default;
    },
    setPaletteOpen(state, action: PayloadAction<boolean>) {
      state.paletteOpen = action.payload;
    },
    togglePalette(state) {
      state.paletteOpen = !state.paletteOpen;
    },
    setMobileNavOpen(state, action: PayloadAction<boolean>) {
      state.mobileNavOpen = action.payload;
    },
  },
});

export const { setTheme, toggleSidebar, resizeSidebar, resetSidebarWidth, setPaletteOpen, togglePalette, setMobileNavOpen } =
  uiSlice.actions;
export const uiReducer = uiSlice.reducer;

/** Writes the persisted parts after every ui change (called by the store's
 * listener). */
export function persistUi(ui: UiState) {
  if (ui.persistTheme) writeStored(THEME_KEY, ui.theme);
  writeStored(SIDEBAR_COLLAPSED_KEY, String(ui.sidebar.collapsed));
  writeStored(SIDEBAR_WIDTH_KEY, String(ui.sidebar.width));
  writeStored(SIDEBAR_LAST_WIDTH_KEY, String(ui.sidebar.lastWidth));
}
