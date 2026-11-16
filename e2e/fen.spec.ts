import { drawnPieces, expect, moveTexts, openApp, playMoves, test } from './helpers';

const input = (page: import('@playwright/test').Page) => page.locator('#fen-input');

test('Explore shows the position code and loads any position pasted into it', async ({ page }) => {
  await openApp(page);
  await expect(input(page)).toHaveValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  await playMoves(page, ['e2e4']);
  await expect(input(page)).toHaveValue(/^rnbqkbnr\/pppppppp\/8\/8\/4P3\//);

  // Only the pieces part is needed: White is to move.
  await input(page).fill('4k3/8/8/8/8/8/3Q4/4K3');
  await input(page).press('Enter');
  await expect(page.locator('cg-board piece')).toHaveCount(3);
  expect(await drawnPieces(page)).toEqual({ e8: 'black king', d2: 'white queen', e1: 'white king' });
  await expect(input(page)).toHaveValue('4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1');
  expect(await moveTexts(page)).toEqual([]);

  // Moves go on from there.
  await playMoves(page, ['d2d7']);
  await expect(page.locator('#status')).toContainText(/Black/);

  // New game goes back to the normal start.
  await page.locator('#reset').click();
  await expect(page.locator('cg-board piece')).toHaveCount(32);
});

test('a position code that cannot be right is refused with a reason, and the board stays', async ({ page }) => {
  await openApp(page);
  await input(page).fill('8/8/8/8/8/8/8/4K3 w - - 0 1');
  await page.locator('#fen-load').click();
  await expect(page.locator('#fen-error')).toBeVisible();
  await expect(page.locator('#fen-error')).toContainText('king');
  await expect(page.locator('cg-board piece')).toHaveCount(32);
});
