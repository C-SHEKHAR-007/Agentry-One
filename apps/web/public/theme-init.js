// Loaded as a separate (non-module) script so the page's CSP can forbid
// inline scripts; it still runs synchronously before first paint.
// Apply the theme class before first paint to avoid a flash of the
// wrong theme. Mirrors the logic in src/lib/theme.tsx.
(function () {
  try {
    // ?theme=light|dark overrides the stored preference for this load
    // (useful for sharing links in a specific theme).
    var override = new URLSearchParams(location.search).get("theme");
    var stored =
      override === "light" || override === "dark"
        ? override
        : localStorage.getItem("agentry-theme");
    var dark =
      stored === "dark" ||
      (stored === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches) ||
      !stored; // default: dark
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
