import { expect, openApp, playMoves, test } from './helpers';

// The cursed board shakes on purpose; people who ask their system for less motion (and these tests) get it still.
test.use({ reducedMotion: 'reduce' });

const SCHOLAR = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

test('board and piece styles can be picked, are remembered, and the cursed set makes explosions', async ({ page }) => {
  await openApp(page);
  const board = page.locator('#board');
  await expect(board).toHaveAttribute('data-board', 'walnut');
  await expect(board).toHaveAttribute('data-pieces', 'classic');

  await page.locator('#open-settings').click();
  await expect(page.locator('#board-styles .style-tile')).toHaveCount(11);
  await expect(page.locator('#piece-styles .style-tile')).toHaveCount(10);
  await page.locator('#board-styles .style-tile', { hasText: 'Ocean blue' }).click();
  await page.locator('#piece-styles .style-tile', { hasText: 'Merida' }).click();
  await expect(board).toHaveAttribute('data-board', 'blue');
  await expect(board).toHaveAttribute('data-pieces', 'merida');
  const image = await page.locator('#board piece.king.white').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(image).toContain('/pieces/merida/wK.svg');
  await page.locator('#settings-close').click();

  // Remembered after a reload. Let the piece previews and the engine finish loading first: a reload
  // aborts requests still in flight, and the no-errors guard would count those as failures.
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect(board).toHaveAttribute('data-board', 'blue');

  // Cursed: captures become explosions.
  await page.locator('#open-settings').click();
  await page.locator('#piece-styles .style-tile', { hasText: 'CURSED' }).click();
  await page.locator('#board-styles .style-tile', { hasText: 'CURSED' }).click();
  await page.screenshot({ path: 'test-results/cursed-settings.png' });
  await page.locator('#settings-close').click();
  await playMoves(page, ['e2e4', 'd7d5', 'e4d5']);
  expect(await page.evaluate(() => document.body.dataset.lastSound)).toBe('explosion');
  await page.screenshot({ path: 'test-results/cursed-board.png' });

  // Back to normal: a plain capture sound again.
  await page.locator('#open-settings').click();
  await page.locator('#piece-styles .style-tile', { hasText: 'Classic' }).click();
  await page.locator('#board-styles .style-tile', { hasText: 'Classic brown' }).click();
  await page.locator('#settings-close').click();
  await page.locator('#reset').click();
  await playMoves(page, ['e2e4', 'd7d5', 'e4d5']);
  expect(await page.evaluate(() => document.body.dataset.lastSound)).toBe('capture');
});

test('Analyse shows the icon of every move at the top right of its square', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('chauss.analysis.v1', JSON.stringify({ version: 1, limit: 'd10' }));
  });
  await openApp(page);
  await page.locator('#mode-analysis').click();
  await page.locator('#analysis-pgn').fill(SCHOLAR);
  await page.locator('#analysis-start').click();
  await expect(page.locator('#analysis-run')).toBeHidden({ timeout: 60_000 });

  // 4.Qxf7# is "best": the icon sits on f7. A blunder gets one too.
  await page.locator('#moves .move', { hasText: 'Qxf7#' }).click();
  await expect(page.locator('#board')).toHaveAttribute('data-badge', 'f7:best');
  const badge = page.locator('#board .move-badge .class-icon');
  await expect(badge).toHaveCount(1);
  const boardBox = (await page.locator('#board cg-board').boundingBox())!;
  const iconBox = (await badge.boundingBox())!;
  const square = boardBox.width / 8;
  // f7: file 5, rank 7 from the bottom = row 1. The icon's centre is in the right half and top half of it.
  const col = (iconBox.x + iconBox.width / 2 - boardBox.x) / square;
  const row = (iconBox.y + iconBox.height / 2 - boardBox.y) / square;
  expect(Math.floor(col)).toBe(5);
  expect(col - 5).toBeGreaterThan(0.6);
  expect(Math.floor(row)).toBe(1);
  expect(row - 1).toBeLessThan(0.4);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/analyse-badge.png' });

  await page.locator('#moves .move', { hasText: 'Nf6' }).click();
  await expect(page.locator('#board')).toHaveAttribute('data-badge', 'f6:blunder');

  // Flipping the board keeps it on the right square.
  await page.locator('#moves .move', { hasText: 'Qxf7#' }).click();
  await page.locator('#flip').click();
  await expect(page.locator('#board .move-badge')).toHaveCount(1);
});
