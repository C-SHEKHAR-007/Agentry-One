import { afterEach, describe, expect, it, vi } from "vitest";
import { coverRadius, readTransitionPrefs, switchThemeAnimated, writeTransitionPrefs } from "../themeTransition";

// The DOM types already describe startViewTransition; tests swap in stand-ins.
const doc = document as unknown as { startViewTransition?: unknown };
const motion = (reduce: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ matches: reduce && q.includes("reduce"), media: q }) as MediaQueryList);

afterEach(() => {
  vi.restoreAllMocks();
  delete doc.startViewTransition;
  document.documentElement.className = "";
  localStorage.clear();
});

describe("theme switch animation", () => {
  it("covers the window from any point", () => {
    expect(coverRadius(0, 0, 300, 400)).toBe(500);
    expect(coverRadius(1400, 20, 1440, 900)).toBe(Math.ceil(Math.hypot(1400, 880)));
  });

  it("switches instantly without the View Transitions API", () => {
    motion(false);
    const apply = vi.fn();
    switchThemeAnimated({ apply, origin: { x: 10, y: 10 }, toDark: false });
    expect(apply).toHaveBeenCalledOnce();
  });

  it("switches instantly for reduced motion, the Off style, or no origin", () => {
    const start = vi.fn();
    doc.startViewTransition = start;
    const apply = vi.fn();
    const mq = motion(true);
    switchThemeAnimated({ apply, origin: { x: 1, y: 1 }, toDark: true });
    mq.mockImplementation((q: string) => ({ matches: false, media: q }) as MediaQueryList);
    switchThemeAnimated({ apply, origin: { x: 1, y: 1 }, toDark: true, prefs: { style: "off", durationMs: 650 } });
    switchThemeAnimated({ apply, origin: null, toDark: true });
    expect(apply).toHaveBeenCalledTimes(3);
    expect(start).not.toHaveBeenCalled();
  });

  it("animates from the origin, picking grow or shrink by direction", async () => {
    motion(false);
    let finish!: () => void;
    doc.startViewTransition = vi.fn((update: () => Promise<void>) => {
      void update();
      return { finished: new Promise<void>((r) => (finish = r)), skipTransition: vi.fn() };
    });
    const apply = vi.fn();
    const root = document.documentElement;

    switchThemeAnimated({ apply, origin: { x: 100, y: 50 }, toDark: true, prefs: { style: "grow-shrink", durationMs: 800 } });
    expect(apply).toHaveBeenCalledOnce();
    expect(root.classList.contains("vt-shrink")).toBe(true);
    expect(root.style.getPropertyValue("--vt-x")).toBe("100px");
    expect(root.style.getPropertyValue("--vt-duration")).toBe("800ms");
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.classList.contains("vt-shrink")).toBe(false);

    switchThemeAnimated({ apply, origin: { x: 100, y: 50 }, toDark: false, prefs: { style: "grow-shrink", durationMs: 800 } });
    expect(root.classList.contains("vt-grow")).toBe(true);
  });

  it("remembers the chosen style and speed, and ignores junk", () => {
    expect(readTransitionPrefs()).toEqual({ style: "grow", durationMs: 650 });
    writeTransitionPrefs({ style: "soft", durationMs: 500 });
    expect(readTransitionPrefs()).toEqual({ style: "soft", durationMs: 500 });
    localStorage.setItem("agentry-theme-transition", '{"style":"spin","durationMs":9}');
    expect(readTransitionPrefs()).toEqual({ style: "grow", durationMs: 650 });
  });
});
