import { enterDrill, expect, openApp, playMoves, test } from './helpers';

/**
 * Screenshots of every screen, for design work: compare a "before" and an "after" set by eye.
 * Skipped in normal test runs. Run with:
 *   SCREENS=before npx playwright test e2e/screens.spec.ts
 * PNGs land in screens/<label>/<size>-<screen>.png (gitignored).
 */
const label = process.env.SCREENS;
const sizes = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

for (const size of sizes) {
  test.describe(`screens at ${size.name}`, () => {
    test.skip(!label, 'set SCREENS=<label> to take design screenshots');
    test.use({ viewport: { width: size.width, height: size.height } });
    const shot = (name: string) => ({ path: `screens/${label}/${size.name}-${name}.png`, fullPage: true });
    // Every screen: nothing makes the page scroll sideways.
    test.afterEach(async ({ page }) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(wide, "the page should not scroll sideways").toBeLessThanOrEqual(0);
    });

    test('explore', async ({ page }) => {
      await openApp(page);
      await playMoves(page, ['e2e4']);
      await page.locator('#toggle-eval').click();
      await page.locator('#toggle-arrows').click();
      await expect(page.locator('#engine-lines li').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      await page.screenshot(shot('explore'));
      const toolbar = await page.locator('.toolbar').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(toolbar, "the board toolbar should fit").toBeLessThanOrEqual(0);
    });

    test('drill hub and drill', async ({ page }) => {
      await openApp(page);
      await page.locator('#mode-drill').click();
      await page.screenshot(shot('drill-hub'));
      await page.locator('#drill-hub [data-category="openings"]').click();
      await page.screenshot(shot('drill-openings'));
      await page.locator('#mode-explore').click();
      await enterDrill(page);
      await expect(page.locator('#drill-prompt')).toHaveAttribute('data-state', 'asking');
      await page.waitForTimeout(800); // let the opponent's move finish animating
      await page.screenshot(shot('drill'));
      await page.locator('#open-stats').click();
      await expect(page.locator('#stats')).toBeVisible();
      await page.screenshot(shot('stats'));
    });

    test('analyse', async ({ page }) => {
      await openApp(page);
      await page.locator('#mode-analysis').click();
      await page.locator('#analysis-pgn').fill('1.e4 e5 2.Nf3 Nc6 3.c3 Nf6 4.d4 Nxe4 5.d5');
      await page.locator('#analysis-start').click();
      await expect(page.locator('#analysis-result')).toBeVisible({ timeout: 120_000 });
      await page.screenshot(shot('analyse'));
    });

    test('settings', async ({ page }) => {
      await openApp(page);
      await page.locator('#open-settings').click();
      await expect(page.locator('#settings')).toBeVisible();
      await page.screenshot(shot('settings'));
    });
  });
}
