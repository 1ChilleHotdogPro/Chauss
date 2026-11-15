import { enterDrill, expect, openApp, test } from './helpers';

test('the navigation sits above the board and the Play tab is gone', async ({ page }) => {
  await openApp(page);
  const nav = page.locator('header .mode-tabs');
  await expect(nav.locator('button')).toHaveText(['Explore', 'Drill', 'Analyse']);
  const navBox = (await nav.boundingBox())!;
  const boardBox = (await page.locator('#board').boundingBox())!;
  expect(navBox.y + navBox.height).toBeLessThanOrEqual(boardBox.y);
  await expect(page.locator('#mode-play')).toHaveCount(0);
});

test('Drill opens a full-page choice: Openings or Endgames', async ({ page }) => {
  await openApp(page);
  await page.locator('#mode-drill').click();
  const hub = page.locator('#drill-hub');
  await expect(hub).toBeVisible();
  await expect(page.locator('.layout')).toBeHidden();
  await expect(hub.locator('[data-category]')).toHaveText([/Openings/, /Endgames/]);

  // Endgames lists the endgame drills from the data.
  await hub.locator('[data-category="endgames"]').click();
  await expect(hub.locator('[data-entry="kq-vs-k"]')).toContainText('King and Queen vs King');
  await hub.getByRole('button', { name: /All drills/ }).click();

  // Openings lists every opening; the current one is marked.
  await hub.locator('[data-category="openings"]').click();
  await expect(hub.locator('[data-entry]')).toHaveCount(2);
  await expect(hub.locator('[data-entry="ponziani"]')).toHaveAttribute('aria-current', 'true');
});

test('choosing an opening starts its drill; the menu button leads back to switch', async ({ page }) => {
  await openApp(page);
  await enterDrill(page);
  await expect(page.locator('#drill-prompt')).toHaveAttribute('data-state', 'asking');
  await expect(page.locator('.layout')).toBeVisible();

  await page.locator('#drill-menu').click();
  await expect(page.locator('#drill-hub')).toBeVisible();
  await expect(page.locator('.layout')).toBeHidden();

  // Switching opening reloads straight into the other drill, played from Black's side.
  await enterDrill(page, 'caro-kann');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
  await expect(page.locator('#drill-prompt')).toHaveAttribute('data-state', 'asking');
  await expect(page.locator('#drill-hub')).toBeHidden();
});

test('the Drill tab opens the hub from inside a drill, and Explore leaves it', async ({ page }) => {
  await openApp(page);
  await enterDrill(page);
  await page.locator('#mode-drill').click();
  await expect(page.locator('#drill-hub')).toBeVisible();
  await page.locator('#mode-explore').click();
  await expect(page.locator('#drill-hub')).toBeHidden();
  await expect(page.locator('.layout')).toBeVisible();
});

test('the hub cards show a board, the side you play and honest progress, and fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.locator('#mode-drill').click();
  const hub = page.locator('#drill-hub');
  await expect(hub.locator('[data-category] .mini-board')).toHaveCount(2);
  await hub.locator('[data-category="openings"]').click();
  const ponziani = hub.locator('[data-entry="ponziani"]');
  await expect(ponziani.locator('.mini-board image')).toHaveCount(32);
  await expect(ponziani.locator('.side-badge')).toHaveText('You play White');
  await expect(hub.locator('[data-entry="caro-kann"] .side-badge')).toHaveText('You play Black');
  // Nothing drilled yet in this fresh browser: no invented numbers.
  await expect(hub.locator('[data-entry="caro-kann"] .card-progress')).toHaveText('Not started yet');
  await expect(ponziani.locator('.card-progress')).toContainText('Not started yet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
