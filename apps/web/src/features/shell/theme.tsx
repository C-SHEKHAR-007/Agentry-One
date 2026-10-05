import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setTheme as setThemeAction, type Theme } from "./ui.slice";
import { originOf, switchThemeAnimated } from "./themeTransition";

const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const resolveTheme = (t: Theme): "light" | "dark" => (t === "system" ? (systemPrefersDark() ? "dark" : "light") : t);

/** Applies the theme from the store to <html> and follows the OS setting
 * while the theme is "system". Mount once, near the root. */
export function ThemeSync() {
  const theme = useAppSelector((s) => s.ui.theme);
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return null;
}

/** Current theme, what it resolves to, and a setter. Pass the clicked
 * element to `setTheme` and the change spreads out from it. */
export function useTheme() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const [resolved, setResolved] = useState(() => resolveTheme(theme));
  useEffect(() => {
    setResolved(resolveTheme(theme));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(resolveTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  const setTheme = useCallback(
    (t: Theme, from?: Element | null) => {
      const toDark = resolveTheme(t) === "dark";
      const looksChanged = document.documentElement.classList.contains("dark") !== toDark;
      switchThemeAnimated({
        // Switch synchronously, so the browser captures the new theme.
        apply: () => {
          flushSync(() => dispatch(setThemeAction(t)));
          document.documentElement.classList.toggle("dark", toDark);
        },
        // Nothing to animate when the colours stay the same (e.g. System -> Dark at night).
        origin: looksChanged ? originOf(from) : null,
        toDark,
      });
    },
    [dispatch],
  );
  return { theme, resolved, setTheme };
}
