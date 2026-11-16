import { expect, test } from '@playwright/test';

// The Settings → Website design picker: every design applies to the whole page, is remembered across
// reloads, and loads without console errors. Screenshots of each design land in screens/ (gitignored).
const THEMES = ['academia', 'parchment', 'midnight', 'tournament', 'terminal'] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('chauss.opening.v1')) localStorage.setItem('chauss.opening.v1', 'ponziani');
  });
});

test('Settings offers five website designs and each one sticks after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-site-theme', 'academia');

  for (const theme of THEMES) {
    await page.getByRole('button', { name: 'Settings' }).click();
    const tiles = page.locator('#site-themes [role="radio"]');
    await expect(tiles).toHaveCount(THEMES.length);
    await page.locator(`#site-themes [data-theme="${theme}"]`).click();
    await expect(page.locator(`#site-themes [data-theme="${theme}"]`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-site-theme', theme);
    await page.screenshot({ path: `screens/theme-${theme}-settings.png` });
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-site-theme', theme);
    await page.locator('#board cg-board').waitFor();
    await page.screenshot({ path: `screens/theme-${theme}-explore.png` });
  }
  expect(errors).toEqual([]);
});

test('each design fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of THEMES) {
    await page.addInitScript((id) => {
      localStorage.setItem('chauss.appearance.v1', JSON.stringify({ theme: id }));
    }, theme);
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-site-theme', theme);
    await page.locator('#board cg-board').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `screens/theme-${theme}-phone.png` });
  }
});
