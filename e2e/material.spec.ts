import { expect, openApp, playMoves, test } from './helpers';

const bottom = (page: import('@playwright/test').Page) => page.locator('#captured-bottom');
const top = (page: import('@playwright/test').Page) => page.locator('#captured-top');

test('captured pieces and the material lead are shown above and below the board', async ({ page }) => {
  await openApp(page);
  await expect(bottom(page)).toHaveAttribute('aria-label', 'White has captured nothing');
  await expect(page.locator('.captured-lead')).toHaveCount(0);

  // White takes a pawn: it shows at the bottom (White's side) with a +1.
  await playMoves(page, ['e2e4', 'd7d5', 'e4d5']);
  await expect(bottom(page).locator('.captured-piece')).toHaveCount(1);
  await expect(bottom(page).locator('.captured-piece')).toHaveAttribute('data-color', 'black');
  await expect(bottom(page).locator('.captured-lead')).toHaveText('+1');
  await expect(top(page).locator('.captured-piece')).toHaveCount(0);
  await expect(top(page).locator('.captured-lead')).toHaveCount(0);

  // Black takes the pawn back with the queen: White has lost a pawn, Black a pawn — level again.
  await playMoves(page, ['d8d5']);
  await expect(top(page).locator('.captured-piece')).toHaveCount(1);
  await expect(top(page).locator('.captured-piece')).toHaveAttribute('data-color', 'white');
  await expect(page.locator('.captured-lead')).toHaveCount(0);

  // Black queen takes more: a knight. Black is ahead by 3 and the strips follow the flipped board.
  await playMoves(page, ['b1c3', 'd5d2', 'c1d2']);
  await page.locator('#flip').click();
  await expect(top(page)).toHaveAttribute('data-side', 'white');
  await expect(bottom(page)).toHaveAttribute('data-side', 'black');

  // Stepping back shows the material of the earlier position.
  await page.locator('#flip').click();
  await page.locator('#prev').click();
  await expect(bottom(page).locator('.captured-piece')).toHaveCount(1);
});

test('the captured-pieces lines fit on a phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await playMoves(page, ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5d2', 'c1d2']);
  await expect(top(page).locator('.captured-piece')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const board = await page.locator('#board').boundingBox();
  const strip = await bottom(page).boundingBox();
  expect(strip!.y).toBeGreaterThanOrEqual(board!.y + board!.height - 1);
  await page.screenshot({ path: 'test-results/material-phone.png' });
});
