import type { Page } from '@playwright/test';
import { expect, moveTexts, openApp, playMoves, test, unguardedTest } from './helpers';

// 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? allows 4.Qxf7# — a blunder no engine can miss.
const BLUNDER_LINE = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6'];

const status = (page: Page) => page.locator('#engine-status');
const evalBar = (page: Page) => page.locator('#evalbar');
/** Arrows as chessground actually draws them (one SVG group per arrow). */
const drawnArrows = (page: Page) => page.locator('.cg-wrap svg.cg-shapes g[cgHash]');

async function engineReady(page: Page): Promise<void> {
  await expect(status(page)).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await expect.poll(async () => Number(await status(page).getAttribute('data-depth'))).toBeGreaterThan(0);
}

test('the engine files load and the engine starts analysing', async ({ page }) => {
  const responses = new Map<string, { status: number; type: string }>();
  page.on('response', (response) => {
    if (response.url().includes('/engine/')) {
      responses.set(response.url().split('/').pop()!, {
        status: response.status(),
        type: response.headers()['content-type'] ?? '',
      });
    }
  });

  await openApp(page);
  await engineReady(page);

  // Served from under /Chauss/, with the right file type for WebAssembly.
  expect(responses.get('stockfish-19-lite-single.js')?.status).toBe(200);
  expect(responses.get('stockfish-19-lite-single.wasm')?.status).toBe(200);
  expect(responses.get('stockfish-19-lite-single.wasm')?.type).toContain('application/wasm');

  await expect(status(page)).toHaveText(/^Stockfish 19 Lite.* · depth \d+$/);
  // It keeps deepening on its own.
  await expect.poll(async () => Number(await status(page).getAttribute('data-depth'))).toBeGreaterThanOrEqual(12);
});

test('eval bar and arrows are hidden until asked for', async ({ page }) => {
  await openApp(page);
  await engineReady(page);

  await expect(evalBar(page)).toBeHidden();
  await expect(page.locator('#engine-lines')).toBeHidden();
  await expect(page.locator('#toggle-eval')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#toggle-arrows')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '0');
  await expect(drawnArrows(page)).toHaveCount(0);

  // Playing moves does not reveal them either.
  await playMoves(page, ['e2e4', 'e7e5']);
  await expect(evalBar(page)).toBeHidden();
  await expect(drawnArrows(page)).toHaveCount(0);
});

test('the eval bar toggles with the button and the E key', async ({ page }) => {
  await openApp(page);
  await engineReady(page);

  await page.locator('#toggle-eval').click();
  await expect(evalBar(page)).toBeVisible();
  await expect(page.locator('#toggle-eval')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toggle-eval')).toHaveText('Hide eval');

  // The start position is roughly equal: a small number, and a bar near the middle.
  await expect(evalBar(page)).toHaveAttribute('data-score', /^([+-]\d\.\d|0\.0)$/);
  const white = Number(await evalBar(page).getAttribute('data-white'));
  expect(white).toBeGreaterThan(40);
  expect(white).toBeLessThan(65);

  // Three engine lines in normal notation, each starting with move 1.
  const lines = page.locator('#engine-lines li');
  await expect(lines).toHaveCount(3);
  await expect(lines.first().locator('.line-moves')).toHaveText(/^1\. [a-hN]/);

  // The bar is as tall as the board and sits beside it.
  const bar = (await evalBar(page).boundingBox())!;
  const boardBox = (await page.locator('cg-board').boundingBox())!;
  expect(Math.abs(bar.height - boardBox.height)).toBeLessThan(3);
  expect(bar.x + bar.width).toBeLessThanOrEqual(boardBox.x);

  await page.keyboard.press('e');
  await expect(evalBar(page)).toBeHidden();
  await expect(page.locator('#engine-lines')).toBeHidden();
  await page.keyboard.press('e');
  await expect(evalBar(page)).toBeVisible();
});

test('arrows toggle with the button and the A key', async ({ page }) => {
  await openApp(page);
  await engineReady(page);

  await page.locator('#toggle-arrows').click();
  await expect(page.locator('#toggle-arrows')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '3');
  await expect(drawnArrows(page)).toHaveCount(3);
  // Arrows alone do not reveal the bar.
  await expect(evalBar(page)).toBeHidden();

  await page.keyboard.press('a');
  await expect(drawnArrows(page)).toHaveCount(0);
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '0');

  await page.keyboard.press('a');
  await expect(drawnArrows(page)).toHaveCount(3);

  // Arrows follow the position: after a move they are redrawn for the new one.
  await playMoves(page, ['e2e4']);
  await expect(drawnArrows(page)).toHaveCount(3);
});

test('a normal move gets no bad mark', async ({ page }) => {
  await openApp(page);
  await engineReady(page);
  await playMoves(page, ['e2e4']);

  const move = page.locator('#moves .move[data-ply="1"]');
  await expect(move).toHaveAttribute('data-verdict', /^(best|good)$/, { timeout: 20_000 });
  await expect(move).not.toHaveAttribute('data-mark', /.+/);
  await expect(page.locator('#verdict')).toHaveText(/^e4 — (best|good) move\.$/);
  expect(await moveTexts(page)).toEqual(['e4']);
});

test('a blunder is flagged, and the bar shows the mate', async ({ page }) => {
  await openApp(page);
  await engineReady(page);
  await playMoves(page, BLUNDER_LINE);

  const blunder = page.locator('#moves .move[data-ply="6"]');
  await expect(blunder).toHaveAttribute('data-verdict', 'blunder', { timeout: 20_000 });
  await expect(blunder).toHaveAttribute('data-mark', '??');
  await expect(blunder).toHaveAttribute('title', 'Blunder');
  // The mark is drawn by CSS, so the move text itself is unchanged.
  expect((await moveTexts(page)).at(-1)).toBe('Nf6');
  const shownMark = await blunder.evaluate((el) => getComputedStyle(el, '::after').content);
  expect(shownMark).toBe('"??"');

  const verdict = page.locator('#verdict');
  await expect(verdict).toHaveAttribute('data-verdict', 'blunder');
  await expect(verdict).toHaveText(
    /^Nf6\?\? Blunder — Black's winning chances fell from \d+% to 0% \(allows mate in 1\)\. Best was \S+\.$/,
  );

  // Still hidden until asked for.
  await expect(evalBar(page)).toBeHidden();
  await page.keyboard.press('e');
  await expect(evalBar(page)).toHaveAttribute('data-score', '#1');
  await expect(evalBar(page)).toHaveAttribute('data-white', '100');
  await expect(page.locator('#engine-lines li').first()).toContainText('4. Qxf7#');

  // The best arrow points at the mating move.
  await page.keyboard.press('a');
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '3');
  await page.screenshot({ path: 'test-results/phase2-blunder.png', fullPage: true });

  // The earlier, sensible moves are not criticised.
  for (const ply of [1, 2]) {
    await expect(page.locator(`#moves .move[data-ply="${ply}"]`)).toHaveAttribute(
      'data-verdict',
      /^(best|good)$/,
      { timeout: 20_000 },
    );
  }

  // Deliver the mate: the game is over and nothing breaks.
  await playMoves(page, ['h5f7']);
  await expect(page.locator('#status')).toHaveText('Checkmate — White wins');
  await expect(status(page)).toHaveText(/game over$/);
  await expect(evalBar(page)).toHaveAttribute('data-score', '#');
  await expect(drawnArrows(page)).toHaveCount(0);
  await expect(page.locator('#moves .move[data-ply="7"]')).toHaveAttribute('data-verdict', 'best');
  await expect(verdict).toHaveText('Qxf7# — best move.');
});

test('bar, arrows and verdict follow the position when stepping through the game', async ({ page }) => {
  await openApp(page);
  await engineReady(page);
  await playMoves(page, BLUNDER_LINE);
  await page.keyboard.press('e');
  await page.keyboard.press('a');
  // Engine results: allow for a slow engine when many browser tests run Stockfish at once.
  const ENGINE = { timeout: 20_000 };
  await expect(evalBar(page)).toHaveAttribute('data-score', '#1', ENGINE);

  // One step back: before the blunder there is no mate, and the verdict is about Bc4.
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#moves .move.current')).toHaveText('Bc4');
  await expect(evalBar(page)).toHaveAttribute('data-score', /^([+-]\d+\.\d|0\.0)$/, ENGINE);
  await expect(page.locator('#verdict')).toHaveText(/^Bc4/, ENGINE);
  await expect(drawnArrows(page)).toHaveCount(3, ENGINE);
  // The blunder keeps its mark while we look at an earlier position.
  await expect(page.locator('#moves .move[data-ply="6"]')).toHaveAttribute('data-verdict', 'blunder', ENGINE);

  // Forward again: the mate is back at once (the result was remembered).
  await page.keyboard.press('ArrowRight');
  await expect(evalBar(page)).toHaveAttribute('data-score', '#1');
  await expect(page.locator('#verdict')).toHaveText(/^Nf6\?\? Blunder/);

  // Undo removes the blunder and its verdict.
  await page.locator('#undo').click();
  await expect(page.locator('#moves .move')).toHaveCount(5);
  await expect(page.locator('#verdict')).toHaveText(/^Bc4/, ENGINE);
  await expect(evalBar(page)).toHaveAttribute('data-score', /^([+-]\d+\.\d|0\.0)$/, ENGINE);

  // Back to the very start: no move, so no verdict.
  await page.locator('#reset').click();
  await expect(page.locator('#verdict')).toBeHidden();
  await expect(evalBar(page)).toHaveAttribute('data-score', /^([+-]\d\.\d|0\.0)$/, ENGINE);
});

test('the eval bar turns with the board', async ({ page }) => {
  await openApp(page);
  await engineReady(page);
  await playMoves(page, BLUNDER_LINE);
  await page.keyboard.press('e');
  await expect(evalBar(page)).toHaveAttribute('data-score', '#1');
  await expect(evalBar(page)).toHaveAttribute('data-orientation', 'white');

  // White is winning: the bar is all light, and the number sits at White's (bottom) end.
  const bar = (await evalBar(page).boundingBox())!;
  const scoreBefore = (await page.locator('.evalbar-score').boundingBox())!;
  expect(scoreBefore.y).toBeGreaterThan(bar.y + bar.height / 2);

  await page.keyboard.press('f');
  await expect(evalBar(page)).toHaveAttribute('data-orientation', 'black');
  // Now White is at the top, and so is the number.
  await expect
    .poll(async () => (await page.locator('.evalbar-score').boundingBox())!.y)
    .toBeLessThan(bar.y + bar.height / 2);
  await expect(evalBar(page)).toHaveAttribute('data-score', '#1');
});

test('the layout with bar and arrows on fits a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openApp(page);
  await engineReady(page);
  await playMoves(page, ['e2e4', 'e7e5']);
  await page.locator('#toggle-eval').click();
  await page.locator('#toggle-arrows').click();
  await expect(evalBar(page)).toBeVisible();
  await expect(drawnArrows(page)).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // The board got narrower to make room for the bar; moves must still land correctly.
  await playMoves(page, ['g1f3']);
  expect(await moveTexts(page)).toEqual(['e4', 'e5', 'Nf3']);
  await page.screenshot({ path: 'test-results/phase2-narrow.png', fullPage: true });
});

unguardedTest('if the engine cannot be loaded, the board still works and says so', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/engine/stockfish-19-lite-single.js', (route) => route.abort());

  await openApp(page);
  await expect(status(page)).toHaveAttribute('data-state', 'failed', { timeout: 20_000 });
  await expect(status(page)).toContainText('could not be loaded');

  await playMoves(page, ['e2e4', 'e7e5']);
  expect(await moveTexts(page)).toEqual(['e4', 'e5']);
  await expect(page.locator('#verdict')).toBeHidden();

  // The toggles do not crash anything without an engine.
  await page.keyboard.press('e');
  await page.keyboard.press('a');
  await playMoves(page, ['g1f3']);
  expect(pageErrors).toEqual([]);
});
