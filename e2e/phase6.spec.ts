import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { buildRepertoire } from '../src/repertoire/repertoire';
import { positionKey, type Snapshot } from '../src/snapshot/format';
import { enterDrill, expect, moveTexts, openApp, test, tryMove } from './helpers';

// The test reads the bundled data to know the repertoire move, the same way the app does.
const read = <T>(path: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')) as T;
const snapshot = read<Snapshot>('../src/data/openings/ponziani.json');
const repertoire = buildRepertoire(snapshot);

const oob = (page: Page) => page.locator('#oob');
const fen = async (page: Page) => (await page.locator('#fen').textContent())!;
const play = (page: Page, uci: string) => tryMove(page, uci.slice(0, 2), uci.slice(2, 4));

test('a drill that runs out of data asks what to do, and can be played on', async ({ page }) => {
  await openApp(page);
  await enterDrill(page);
  const drillPrompt = page.locator('#drill-prompt');
  for (let guard = 0; guard < 30; guard++) {
    await expect
      .poll(async () => {
        const state = await drillPrompt.getAttribute('data-state');
        const interaction = await page.locator('#board').getAttribute('data-interaction');
        const yourTurn = await page.locator('#board').getAttribute('data-your-turn');
        return state === 'finished' || (state === 'asking' && interaction === 'player-only' && yourTurn === 'true');
      })
      .toBe(true);
    if ((await drillPrompt.getAttribute('data-state')) !== 'asking') break;
    const before = await fen(page);
    const card = repertoire.cards.get(positionKey(before))!;
    await play(page, card.move.uci);
    // The board reports the move a moment after the click: wait for it before looking again.
    await expect(page.locator('#fen')).not.toHaveText(before);
  }
  await expect(drillPrompt).toHaveAttribute('data-state', 'finished');
  await expect(oob(page)).toBeVisible();
  await expect(oob(page)).toHaveAttribute('data-state', 'prompt');
  await expect(page.locator('#oob-lead')).toContainText('You have left the opening data');

  // (a) Stop: Stockfish's verdict on the position, the best move and the line.
  await page.locator('#oob-stop').click();
  await expect(oob(page)).toHaveAttribute('data-state', 'stopped');
  await expect(page.locator('#oob-result [data-part="balance"]')).toContainText(/Stockfish \(depth \d+\)/, { timeout: 20_000 });
  await expect(page.locator('#oob-result [data-part="line"]')).toBeVisible();

  // (b) Play on against the weakened Stockfish.
  const count = (await moveTexts(page)).length;
  await page.locator('#oob-strength').selectOption('medium');
  await page.locator('#oob-play').click();
  await expect(oob(page)).toHaveAttribute('data-state', 'engine');
  await expect(page.locator('#oob-lead')).toHaveText('Playing on against Stockfish (Medium).');
  // Whoever is to move, the game goes on: Stockfish moves for Black, then it is White's turn.
  await expect(page.locator('#oob-engine')).toHaveText('Your move as White.', { timeout: 20_000 });
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'player-only');
  expect((await moveTexts(page)).length).toBeGreaterThanOrEqual(count);

  // The strength is remembered.
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('chauss.drill.strength.v1'))).toBe('medium');

  // After a reload the hub is the way back into a drill.
  await enterDrill(page);
});

test('the out-of-data box fits a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openApp(page);
  await enterDrill(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
