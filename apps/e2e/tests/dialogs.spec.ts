import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

/** Samples the open dialog's centre and opacity on every animation frame
 * for `ms`, starting now. */
async function sampleDialog(page: Page, ms: number) {
  await page.evaluate((duration) => {
    const w = window as unknown as { __samples: Array<[number, number, number]> };
    w.__samples = [];
    const t0 = performance.now();
    const tick = () => {
      const d = document.querySelector('[role="dialog"]');
      if (d) {
        const r = d.getBoundingClientRect();
        w.__samples.push([r.left + r.width / 2, r.top + r.height / 2, +getComputedStyle(d).opacity]);
      }
      if (performance.now() - t0 < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
}

// Dialogs used to be centred with translate(-50%,-50%) while their opening
// animation also set transform, so they appeared low and to the right and
// then jumped into place. They must stay centred throughout.
test("dialogs open centred (no jump), animate in and out", async ({ page }) => {
  await page.goto("/team");
  await sampleDialog(page, 1000);
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(1100);
  const samples = await page.evaluate(() => (window as unknown as { __samples: Array<[number, number, number]> }).__samples);
  expect(samples.length).toBeGreaterThan(1);
  for (const [x, y] of samples) {
    expect(Math.abs(x - 720)).toBeLessThanOrEqual(2); // horizontally centred every frame
    expect(Math.abs(y - 450)).toBeLessThanOrEqual(16); // only the small rise-in offset
  }
  // It fades in (starts transparent, ends opaque).
  expect(samples[0][2]).toBeLessThan(1);
  expect(samples.at(-1)![2]).toBe(1);

  // Closing animates out and then unmounts.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("provider dialogs are real dialogs: centred, Escape closes", async ({ page }) => {
  await page.goto("/providers");
  await page.getByRole("button", { name: "Register AI Provider" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Register AI provider" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(350);
  const box = (await dialog.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
