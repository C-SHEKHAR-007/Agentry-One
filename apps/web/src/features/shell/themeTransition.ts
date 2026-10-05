import { readStored, writeStored } from "../../app/persistence";

/* The theme switch animates as a circle spreading from the button that was
 * clicked, using the browser's View Transitions API: the browser snapshots
 * the page, we switch the theme, and the new look is revealed through a
 * growing circle (CSS in styles/index.css, "Theme switch"). Browsers without
 * the API, and people who ask for reduced motion, get an instant switch.
 *
 * The style (grow, grow & shrink back, soft edge, or off) and the speed are
 * chosen in Settings and kept in this browser. */

export type TransitionStyle = "grow" | "grow-shrink" | "soft" | "off";
export interface TransitionPrefs {
  style: TransitionStyle;
  durationMs: number;
}

export const TRANSITION_STYLES: { value: TransitionStyle; label: string; hint: string }[] = [
  { value: "grow", label: "Grow", hint: "The new theme spreads out from the button" },
  { value: "grow-shrink", label: "Grow & shrink back", hint: "Light grows out, dark folds back into the button" },
  { value: "soft", label: "Soft edge", hint: "Like Grow, with a feathered edge" },
  { value: "off", label: "Off", hint: "Switch instantly" },
];
export const TRANSITION_SPEEDS = [500, 650, 800] as const;

const KEY = "agentry-theme-transition";
const DEFAULT_PREFS: TransitionPrefs = { style: "grow", durationMs: 650 };
/** How far the soft edge fades, in px; the circle grows that much further. */
const FEATHER = 140;

export function readTransitionPrefs(): TransitionPrefs {
  return readStored(
    KEY,
    (raw) => {
      try {
        const p = JSON.parse(raw) as Partial<TransitionPrefs>;
        const style = TRANSITION_STYLES.some((s) => s.value === p.style) ? p.style! : DEFAULT_PREFS.style;
        const durationMs = TRANSITION_SPEEDS.includes(p.durationMs as 500) ? p.durationMs! : DEFAULT_PREFS.durationMs;
        return { style, durationMs };
      } catch {
        return undefined;
      }
    },
    DEFAULT_PREFS,
  );
}

export const writeTransitionPrefs = (p: TransitionPrefs) => writeStored(KEY, JSON.stringify(p));

/** Distance from (x, y) to the farthest corner: a circle this big covers the window. */
export function coverRadius(x: number, y: number, width: number, height: number): number {
  return Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y)));
}

/** The centre of the element that was clicked, if there was one. */
export function originOf(el: Element | null | undefined): { x: number; y: number } | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

type ViewTransition = { finished: Promise<void>; skipTransition(): void };
type DocumentWithTransitions = Document & { startViewTransition?: (update: () => Promise<void> | void) => ViewTransition };

let running: ViewTransition | null = null;

/** Applies a theme change (`apply` must switch it synchronously), animated
 * from `origin` when the browser, the user's motion setting and the chosen
 * style allow it. */
export function switchThemeAnimated({
  apply,
  origin,
  toDark,
  prefs = readTransitionPrefs(),
}: {
  apply: () => void;
  origin: { x: number; y: number } | null;
  toDark: boolean;
  prefs?: TransitionPrefs;
}): void {
  const doc = document as DocumentWithTransitions;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!origin || prefs.style === "off" || reduceMotion || typeof doc.startViewTransition !== "function") {
    apply();
    return;
  }
  // A click mid-transition finishes the running one first.
  running?.skipTransition();

  const mode = prefs.style === "grow-shrink" ? (toDark ? "shrink" : "grow") : prefs.style;
  const root = document.documentElement;
  const radius = coverRadius(origin.x, origin.y, window.innerWidth, window.innerHeight) + (mode === "soft" ? FEATHER : 0);
  root.style.setProperty("--vt-x", `${origin.x}px`);
  root.style.setProperty("--vt-y", `${origin.y}px`);
  root.style.setProperty("--vt-r", `${radius}px`);
  root.style.setProperty("--vt-duration", `${prefs.durationMs}ms`);
  // Elements' own colour transitions would fade inside the new view (cards
  // showing half-switched); the circle is the only animation.
  root.classList.add(`vt-${mode}`, "vt-instant-colors");

  const transition = doc.startViewTransition(async () => {
    apply();
    // Let class observers (the 3D scene redraws in the new colours) run
    // before the browser captures the new view.
    await Promise.resolve();
  });
  running = transition;
  void transition.finished.finally(() => {
    root.classList.remove(`vt-${mode}`, "vt-instant-colors");
    if (running === transition) running = null;
  });
}
