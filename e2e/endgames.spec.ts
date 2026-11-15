import { Chess } from 'chess.js';
import type { Page } from '@playwright/test';
import { drawnPieces, expect, openApp, test, tryMove } from './helpers';

/** Stockfish runs in the browser for every move: give it time. */
const ENGINE_WAIT = { timeout: 30_000 };

async function openEndgameDrill(page: Page): Promise<void> {
  await page.locator('#mode-drill').click();
  await page.locator('#drill-hub [data-category="endgames"]').click();
  await page.locator('#drill-hub [data-entry="kq-vs-k"]').click();
  await expect(page.locator('#drill-hub')).toBeHidden();
}

const prompt = (page: Page) => page.locator('#endgame-prompt');
const fen = async (page: Page) => (await page.locator('#fen').textContent()) ?? ''; // folded away in a <details>, so not innerText

/** A move that mates in at most `depth` moves for the side to move (tiny brute force, enough for KQ vs K near the edge). */
function mateIn(fenText: string, depth: number): string | null {
  const chess = new Chess(fenText);
  for (const move of chess.moves({ verbose: true })) {
    chess.move(move);
    let forced = chess.isCheckmate();
    if (!forced && depth > 1 && !chess.isDraw() && !chess.isStalemate()) {
      forced = chess.moves({ verbose: true }).every((reply) => {
        chess.move(reply);
        const mates = mateIn(chess.fen(), depth - 1) !== null;
        chess.undo();
        return mates;
      });
    }
    chess.undo();
    if (forced) return move.from + move.to;
  }
  return null;
}

test('choosing the endgame drill shows its first position, played as White', async ({ page }) => {
  await openApp(page);
  await openEndgameDrill(page);
  await expect(page.locator('#endgame')).toBeVisible();
  await expect(page.locator('#drill')).toBeHidden();
  await expect(page.locator('#endgame-title')).toHaveText('King and Queen vs King');
  await expect(prompt(page)).toHaveAttribute('data-state', 'your-move');
  await expect(prompt(page)).toContainText('Position 1 of 5');
  await expect(page.locator('cg-board piece')).toHaveCount(3);
  expect(await drawnPieces(page)).toEqual({ h8: 'black king', g5: 'white king', f1: 'white queen' });
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
});

test('a stalemating move is taken back, explained, and the better move is shown', async ({ page }) => {
  await openApp(page);
  await openEndgameDrill(page);
  await tryMove(page, 'f1', 'f7');
  await expect(page.locator('#endgame-feedback')).toHaveAttribute('data-kind', 'wrong', ENGINE_WAIT);
  await expect(page.locator('#endgame-feedback')).toContainText('Stalemate');
  await expect(page.locator('#endgame-counts')).toHaveAttribute('data-mistakes', '1');
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '1');
  expect(await drawnPieces(page)).toEqual({ h8: 'black king', g5: 'white king', f1: 'white queen' });
  await expect(prompt(page)).toHaveAttribute('data-state', 'your-move');
});

test('right moves are accepted, Black defends, and checkmate solves the position; next and retry work', async ({ page }) => {
  await openApp(page);
  await openEndgameDrill(page);

  // Kg6 is Stockfish's best move here (see `npm run endgames`).
  await tryMove(page, 'g5', 'g6');
  await expect(page.locator('#endgame-feedback')).toHaveAttribute('data-kind', 'good', ENGINE_WAIT);
  await expect(page.locator('#moves .move')).toHaveCount(2, ENGINE_WAIT);
  await expect(prompt(page)).toHaveAttribute('data-state', 'your-move', ENGINE_WAIT);

  // From here mate is at most two moves away: find it and play it.
  for (let guard = 0; guard < 3; guard++) {
    if ((await prompt(page).getAttribute('data-state')) !== 'your-move') break;
    const position = await fen(page);
    const move = mateIn(position, 1) ?? mateIn(position, 2);
    expect(move, 'a short mate should exist').not.toBeNull();
    const before = await page.locator('#moves .move').count();
    await tryMove(page, move!.slice(0, 2), move!.slice(2, 4));
    await expect(prompt(page)).not.toHaveAttribute('data-state', 'judging', ENGINE_WAIT);
    await expect(async () => {
      const state = await prompt(page).getAttribute('data-state');
      const count = await page.locator('#moves .move').count();
      expect(state === 'solved' || (state === 'your-move' && count === before + 2)).toBe(true);
    }).toPass(ENGINE_WAIT);
  }
  await expect(prompt(page)).toHaveAttribute('data-state', 'solved');
  await expect(prompt(page)).toContainText('★★★');
  await expect(page.locator('#status')).toContainText('Checkmate');
  // The result is stored.
  const stored = await page.evaluate(() => localStorage.getItem('chauss.endgames.v1'));
  expect(JSON.parse(stored!).drills['kq-vs-k']['edge-1']).toMatchObject({ attempts: 1, solved: 1, bestStars: 3 });

  // Next position.
  await page.locator('#endgame-next').click();
  await expect(prompt(page)).toContainText('Position 2 of 5');
  expect(await fen(page)).toBe('8/8/8/8/8/2k5/8/K6Q w - - 0 1');

  // Retry puts the position back after a move.
  await tryMove(page, 'h1', 'd5'); // Qd5, Stockfish's best move here
  await expect(page.locator('#moves .move')).toHaveCount(2, ENGINE_WAIT);
  await expect(prompt(page)).toHaveAttribute('data-state', 'your-move', ENGINE_WAIT);
  await page.locator('#endgame-retry').click();
  await expect(page.locator('#moves .move')).toHaveCount(0);
  expect(await fen(page)).toBe('8/8/8/8/8/2k5/8/K6Q w - - 0 1');
});

test('the drill menu button leaves the endgame and the opening drill comes back as before', async ({ page }) => {
  await openApp(page);
  await openEndgameDrill(page);
  await page.locator('#endgame-menu').click();
  await expect(page.locator('#drill-hub')).toBeVisible();
  await page.locator('#drill-hub [data-category="openings"]').click();
  await page.locator('#drill-hub [data-entry="ponziani"]').click();
  await expect(page.locator('#drill')).toBeVisible();
  await expect(page.locator('#endgame')).toBeHidden();
  await expect(page.locator('#drill-prompt')).toHaveAttribute('data-state', 'asking');
  await expect(page.locator('cg-board piece')).not.toHaveCount(3);
});

test('playing every position to mate finishes the drill with a summary, and it can be started again', async ({ page }) => {
  test.setTimeout(240_000);
  // The "player": the same Stockfish file, run under Node, finding the best move for each position.
  const { createEvaluator } = await import('../scripts/lib/nodeEngine');
  const { ENGINE_FILE } = await import('../src/engine/workerTransport');
  const player = createEvaluator(`public/${ENGINE_FILE}`, 22);
  try {
    await player.ready();
    await openApp(page);
    await openEndgameDrill(page);
    for (let position = 1; position <= 5; position++) {
      await expect(prompt(page)).toContainText(`Position ${position} of 5`);
      for (let guard = 0; guard < 20; guard++) {
        await expect(prompt(page)).toHaveAttribute('data-state', /your-move|solved/, ENGINE_WAIT);
        if ((await prompt(page).getAttribute('data-state')) === 'solved') break;
        const before = await page.locator('#moves .move').count();
        const best = (await player.evaluateLine(await fen(page))).pv[0]!;
        await tryMove(page, best.slice(0, 2), best.slice(2, 4));
        await expect(async () => {
          const state = await prompt(page).getAttribute('data-state');
          const count = await page.locator('#moves .move').count();
          expect(state === 'solved' || (state === 'your-move' && count === before + 2)).toBe(true);
        }).toPass(ENGINE_WAIT);
      }
      await expect(prompt(page)).toHaveAttribute('data-state', 'solved');
      await page.keyboard.press('Enter'); // Enter = Next position / See your results
    }
    await expect(prompt(page)).toHaveAttribute('data-state', 'summary');
    await expect(prompt(page)).toContainText('5 of 5 solved');
    await expect(page.locator('#endgame-summary tbody tr')).toHaveCount(5);
    await page.locator('#endgame-again').click();
    await expect(prompt(page)).toContainText('Position 1 of 5');
    await expect(page.locator('#endgame-summary')).toBeHidden();
  } finally {
    player.close();
  }
});
