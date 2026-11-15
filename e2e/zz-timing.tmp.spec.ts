import { Chess } from 'chess.js';
import { expect, openApp, test } from './helpers';

test('timing: 80-ply game at the default depth', async ({ page }) => {
  test.setTimeout(600_000);
  const chess = new Chess();
  for (let i = 0; chess.history().length < 80 && !chess.isGameOver(); i++) {
    const moves = chess.moves();
    chess.move(moves[(i * 7 + 3) % moves.length]!);
  }
  await openApp(page);
  await page.locator('#mode-analysis').click();
  await page.locator('#analysis-pgn').fill(chess.pgn());
  const start = Date.now();
  await page.locator('#analysis-start').click();
  // The page stays responsive meanwhile: stepping through moves works.
  await page.locator('#moves .move').nth(5).click();
  await expect(page.locator('#moves .move.current')).toHaveCount(1);
  await expect(page.locator('#analysis-run')).toBeHidden({ timeout: 590_000 });
  console.log(`PLIES ${chess.history().length} SECONDS ${(Date.now() - start) / 1000}`);
});
