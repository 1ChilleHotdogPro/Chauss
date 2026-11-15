import type { Page } from '@playwright/test';
import { expect, openApp, playMoves, test } from './helpers';

// A short game with an obvious blunder: 3...Nf6?? allows 4.Qxf7 mate.
const SCHOLAR = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

/** Analyse quickly in tests (or with a given setting from the Settings list). */
async function useLimit(page: Page, limit: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('chauss.analysis.v1', JSON.stringify({ version: 1, limit: value }));
  }, limit);
}

async function analyse(page: Page, pgn: string): Promise<void> {
  await page.locator('#mode-analysis').click();
  await page.locator('#analysis-pgn').fill(pgn);
  await page.locator('#analysis-start').click();
}

const moveButton = (page: Page, san: string) => page.locator('#moves .move', { hasText: san });

test('a pasted game is analysed: icons, accuracy, graph and stepping through it', async ({ page }) => {
  await useLimit(page, 'd10');
  await openApp(page);
  await analyse(page, SCHOLAR);

  await expect(page.locator('#analysis-run')).toBeVisible();
  await expect(page.locator('#analysis-run')).toBeHidden({ timeout: 60_000 });

  // Every move got a classification; the blunder and the mate are what Stockfish says they are.
  await expect(page.locator('#moves .move')).toHaveCount(7);
  await expect(page.locator('#moves .move[data-class]')).toHaveCount(7);
  await expect(moveButton(page, 'Nf6')).toHaveAttribute('data-class', 'blunder');
  await expect(moveButton(page, 'Qxf7#')).toHaveAttribute('data-class', 'best');
  await expect(page.locator('#moves .move').first()).toHaveAttribute('data-class', 'book');

  // Accuracy for both players, under their names from the PGN.
  await expect(page.locator('.analysis-table thead')).toContainText('Alice');
  await expect(page.locator('.analysis-table thead')).toContainText('Bob');
  for (const side of ['white', 'black']) {
    await expect(page.locator(`.analysis-accuracy td[data-side="${side}"]`)).toHaveText(/^\d+\.\d$/);
  }
  await expect(page.locator('.analysis-table tr[data-class="blunder"] td[data-side="black"]')).toHaveText('1');

  // Clicking a move shows it on the board, with a sentence about it.
  await moveButton(page, 'Nf6').click();
  await expect(page.locator('#fen')).toContainText('2n2n2/4p2Q');
  await expect(page.locator('#verdict')).toContainText('is a blunder');
  await expect(page.locator('#verdict')).toContainText('Best was');

  // The arrow keys step through the game; the board cannot be moved on.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#fen')).toContainText('pppp1Qpp');
  // Clicking the left edge of the graph goes back to the start.
  const graph = page.locator('#analysis-graph');
  await graph.click({ position: { x: 2, y: 40 } });
  await expect(page.locator('#fen')).toHaveText('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  await expect(page.locator('.eval-graph-dot[data-class="blunder"]')).toHaveCount(1);

  await page.screenshot({ path: 'test-results/analysis-desktop.png', fullPage: true });
});

test('a running analysis can be cancelled', async ({ page }) => {
  await useLimit(page, 't3000');
  await openApp(page);
  await analyse(page, SCHOLAR);
  await expect(page.locator('#analysis-progress-text')).toContainText('of 8');
  await page.locator('#analysis-cancel').click();
  await expect(page.locator('#analysis-run')).toBeHidden();
  // The pasted game stays on the board, and another one can be started.
  await expect(page.locator('#moves .move')).toHaveCount(7);
  await page.locator('#analysis-another').click();
  await expect(page.locator('#analysis-pgn')).toBeVisible();
});

test('a game that is not valid PGN gets a clear message', async ({ page }) => {
  await openApp(page);
  await analyse(page, '1. e4 e5 2. Ke3');
  await expect(page.locator('#analysis-error')).toHaveText('"Ke3" is not a legal move (move 2).');
  await expect(page.locator('#analysis-run')).toBeHidden();
});

test('the game from the Play tab can be analysed', async ({ page }) => {
  await useLimit(page, 'd10');
  await openApp(page);
  await page.locator('#mode-play').click();
  await expect(page.locator('#play-analyse')).toBeHidden();
  await playMoves(page, ['e2e4']);
  await expect(page.locator('#moves .move')).toHaveCount(2, { timeout: 10_000 }); // the bot replied
  const moves = await page.locator('#moves .move').allTextContents();

  await page.locator('#play-analyse').click();
  await expect(page.locator('#mode-analysis')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#moves .move')).toHaveText(moves);
  await expect(page.locator('#analysis-run')).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('.analysis-table thead')).toContainText('You');

  // Back in Play, the game is still there.
  await page.locator('#mode-play').click();
  await expect(page.locator('#moves .move')).toHaveText(moves);
});

test('the Analyse tab fits a phone-sized screen', async ({ page }) => {
  await useLimit(page, 'd10');
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.locator('#mode-analysis').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/analysis-phone-input.png', fullPage: true });

  await analyse(page, SCHOLAR);
  await expect(page.locator('#analysis-run')).toBeHidden({ timeout: 60_000 });
  await moveButton(page, 'Nf6').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/analysis-phone.png', fullPage: true });
});
