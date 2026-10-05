import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

/** Clicks the theme toggle and reports the theme animations that started. */
async function toggle(page: Page) {
  await page.getByRole("button", { name: "Toggle theme" }).click();
  return page.evaluate(async () => {
    // Starting a transition means capturing the page, which takes a while on
    // a busy machine; allow up to 3s.
    for (let i = 0; i < 300; i++) {
      const ours = document.getAnimations().filter((a) => (a as CSSAnimation).animationName?.startsWith("vt-"));
      if (ours.length) return ours.map((a) => (a as CSSAnimation).animationName);
      await new Promise((r) => setTimeout(r, 10));
    }
    return [];
  });
}

const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("theme switch spreads from the toggle as a circle, then cleans up", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("agentry-theme-transition", JSON.stringify({ style: "grow", durationMs: 650 })));
    await page.goto("/settings");
    const before = await isDark(page);

    expect(await toggle(page)).toContain("vt-reveal");
    // Centred on the toggle button.
    const centre = await page.getByRole("button", { name: "Toggle theme" }).boundingBox();
    const x = await page.evaluate(() => document.documentElement.style.getPropertyValue("--vt-x"));
    expect(Math.abs(parseFloat(x) - (centre!.x + centre!.width / 2))).toBeLessThan(1);

    await expect.poll(() => isDark(page)).toBe(!before);
    await expect.poll(() => page.evaluate(() => document.documentElement.className.includes("vt-"))).toBe(false);

    // Grow & shrink back: going to dark folds the old theme into the button.
    await page.getByRole("radio", { name: "Grow & shrink back" }).click();
    if (await isDark(page)) await toggle(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.className.includes("vt-"))).toBe(false);
    expect(await toggle(page)).toContain("vt-conceal");
    await expect.poll(() => isDark(page)).toBe(true);
  });
});

test.describe("settings", () => {
  test.use({ reducedMotion: "no-preference" });

  test("every style and speed can be chosen, and the choice is kept", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.removeItem("agentry-theme-transition");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/settings");
    const vtClassGone = () => expect.poll(() => page.evaluate(() => document.documentElement.className.includes("vt-"))).toBe(false);

    // Soft edge at the slow speed.
    await page.getByRole("radio", { name: "Soft edge" }).click();
    await page.getByRole("radio", { name: /Slow · 800 ms/ }).click();
    await expect(page.getByRole("radio", { name: "Soft edge" })).toHaveAttribute("aria-checked", "true");
    expect(await toggle(page)).toContain("vt-reveal");
    expect(await page.evaluate(() => document.documentElement.classList.contains("vt-soft"))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--vt-duration"))).toBe("800ms");
    await vtClassGone();

    // Off: an instant switch, and no speed to pick.
    await page.getByRole("radio", { name: "Off" }).click();
    await expect(page.getByRole("radiogroup", { name: "Animation speed" })).toHaveCount(0);
    const before = await isDark(page);
    expect(await toggle(page)).toEqual([]);
    expect(await isDark(page)).toBe(!before);

    // The choice survives a reload.
    await page.getByRole("radio", { name: "Grow & shrink back" }).click();
    await page.getByRole("radio", { name: /Fast · 500 ms/ }).click();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Grow & shrink back" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: /Fast · 500 ms/ })).toHaveAttribute("aria-checked", "true");

    // The Light / Dark buttons in Settings animate from themselves too.
    const light = page.getByRole("button", { name: "Light", exact: true });
    const dark = page.getByRole("button", { name: "Dark", exact: true });
    const target = (await isDark(page)) ? light : dark;
    await target.click();
    const box = await target.boundingBox();
    const x = await page.evaluate(() => document.documentElement.style.getPropertyValue("--vt-x"));
    expect(Math.abs(parseFloat(x) - (box!.x + box!.width / 2))).toBeLessThan(1);
    await vtClassGone();
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the theme switches instantly", async ({ page }) => {
    await page.goto("/settings");
    const before = await isDark(page);
    expect(await toggle(page)).toEqual([]);
    expect(await isDark(page)).toBe(!before);
  });
});
