import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "agentry-theme";

const ThemeContext = createContext<{
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}>({ theme: "dark", resolved: "dark", setTheme: () => {} });

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // ?theme=light|dark forces a theme for this load (mirrors index.html's
    // pre-paint script); it is not persisted unless the user toggles.
    const override = new URLSearchParams(window.location.search).get("theme");
    if (override === "light" || override === "dark") return override;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(theme));

  const [persist, setPersist] = useState(
    () => !new URLSearchParams(window.location.search).get("theme"),
  );

  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    document.documentElement.classList.toggle("dark", r === "dark");
    if (persist) localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const rr = resolve("system");
      setResolved(rr);
      document.documentElement.classList.toggle("dark", rr === "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, persist]);

  // An explicit user toggle always persists, even if this load started from
  // a ?theme= override.
  const setTheme = (t: Theme) => {
    setPersist(true);
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
