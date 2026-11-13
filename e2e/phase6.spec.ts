import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { pickBlackMove, trapRoutes, type BotStyle } from '../src/bot/choose';
import { buildExplorePosition } from '../src/explore/position';
import type { TrapFile } from '../src/explore/traps';
import { buildRepertoire } from '../src/repertoire/repertoire';
import { positionKey, type Snapshot } from '../src/snapshot/format';
import { expect, moveTexts, openApp, test, tryMove } from './helpers';

// The tests read the bundled data and work out what the bot may play the same way the app does,
// so they keep working after the data is rebuilt.
const read = <T>(path: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')) as T;
const snapshot = read<Snapshot>('../src/data/ponziani.json');
const traps = read<TrapFile>('../src/data/traps.json');
const routes = trapRoutes(traps.traps);
const repertoire = buildRepertoire(snapshot);

const prompt = (page: Page) => page.locator('#play-prompt');
const oob = (page: Page) => page.locator('#oob');
const fen = async (page: Page) => (await page.locator('#fen').textContent())!;
const play = (page: Page, uci: string) => tryMove(page, uci.slice(0, 2), uci.slice(2, 4));

/** Every move the bot could choose in a position (sampled finely over its random numbers). */
function allowedReplies(fenBefore: string, style: BotStyle): Set<string> {
  const node = snapshot.nodes[positionKey(fenBefore)];
  if (!node) return new Set();
  const position = buildExplorePosition(node);
  const allowed = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const choice = pickBlackMove(position, style, routes, () => i / 1000);
    if (choice) allowed.add(choice.move.san);
  }
  return allowed;
}

/** White's move for the test to play: the repertoire move, or the opening's own move. */
function whiteMove(fenNow: string, ply: number): string | null {
  const card = repertoire.cards.get(positionKey(fenNow));
  if (card) return card.move.uci;
  const san = snapshot.meta.rootLine[ply];
  if (san === undefined) return null;
  const chess = new Chess(fenNow);
  try {
    const move = chess.move(san);
    return move.from + move.to + (move.promotion ?? '');
  } catch {
    return null;
  }
}

async function openPlay(page: Page): Promise<void> {
  await openApp(page);
  await page.locator('#mode-play').click();
  await expect(page.locator('#mode-play')).toHaveAttribute('aria-selected', 'true');
  await expect(prompt(page)).toHaveAttribute('data-state', 'your-move');
}

/** Wait until the bot has answered (or the game left the data). */
async function settled(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const state = await prompt(page).getAttribute('data-state');
      const interaction = await page.locator('#board').getAttribute('data-interaction');
      return (state === 'your-move' && interaction === 'white-only') || state === 'out' || state === 'over';
    })
    .toBe(true);
}

/** Play the repertoire as White until the game leaves the data; check every Black reply. */
async function playThroughTheData(page: Page, style: BotStyle): Promise<number> {
  let replies = 0;
  for (let guard = 0; guard < 40; guard++) {
    if ((await prompt(page).getAttribute('data-state')) !== 'your-move') break;
    const before = await fen(page);
    const ply = (await moveTexts(page)).length;
    const uci = whiteMove(before, ply);
    if (!uci) break;
    await play(page, uci);
    await expect(page.locator('#moves .move')).toHaveCount(ply + 1);
    const afterWhite = await fen(page);
    await settled(page);

    const moves = await moveTexts(page);
    if (moves.length === ply + 2) {
      const allowed = allowedReplies(afterWhite, style);
      expect(allowed.has(moves.at(-1)!), `${style} bot played ${moves.at(-1)} after ${moves.slice(0, -1).join(' ')}; allowed: ${[...allowed].join(', ')}`).toBe(true);
      await expect(page.locator('#play-last')).toContainText(`Black played`);
      replies += 1;
    }
  }
  return replies;
}

test('the Play tab: the realistic bot answers from the data and the board waits for White', async ({ page }) => {
  await openPlay(page);
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#play-style-realistic')).toBeChecked();
  // Think first: no eval or arrows until asked for; the explorer and the take-back buttons are hidden.
  await expect(page.locator('#evalbar')).toBeHidden();
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '0');
  await expect(page.locator('#toggle-eval')).toBeVisible();
  for (const hidden of ['#explore', '#undo', '#prev', '#next', '#drill', '#oob']) await expect(page.locator(hidden)).toBeHidden();
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'white-only');

  // At least one reply (the bot may leave the main line at once, as real players sometimes do).
  const replies = await playThroughTheData(page, 'realistic');
  expect(replies).toBeGreaterThanOrEqual(1);
  await expect(prompt(page)).toHaveAttribute('data-state', 'out');
  await expect(oob(page)).toBeVisible();
  await page.screenshot({ path: 'test-results/phase6-play-out.png', fullPage: true });
});

test('the punish-me bot prefers the mistakes people make', async ({ page }) => {
  await openPlay(page);
  await page.locator('#play-style-punish').check();
  await expect(page.locator('#play-style-punish')).toBeChecked();
  const replies = await playThroughTheData(page, 'punish');
  expect(replies).toBeGreaterThanOrEqual(2);
  // The choice is remembered.
  await page.reload();
  await page.locator('#mode-play').click();
  await expect(page.locator('#play-style-punish')).toBeChecked();
});

/** A first move for White after which the bundled data has nothing. */
function firstMoveOutOfData(): string {
  const chess = new Chess();
  for (const move of chess.moves({ verbose: true })) {
    if (!snapshot.nodes[positionKey(move.after)]) return move.from + move.to;
  }
  throw new Error('every first move is in the data');
}

test('leaving the data asks what to do; Stop shows the verdict, Play on brings in Stockfish', async ({ page }) => {
  await openPlay(page);
  await play(page, firstMoveOutOfData());
  await expect(prompt(page)).toHaveAttribute('data-state', 'out');
  await expect(oob(page)).toBeVisible();
  await expect(oob(page)).toHaveAttribute('data-state', 'prompt');
  await expect(page.locator('#oob-lead')).toContainText('You have left the opening data');
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'none');

  // (a) Stop: Stockfish's verdict on the position, the best move and the line.
  await page.locator('#oob-stop').click();
  await expect(oob(page)).toHaveAttribute('data-state', 'stopped');
  await expect(page.locator('#oob-result [data-part="balance"]')).toContainText(/Stockfish \(depth \d+\)/, { timeout: 20_000 });
  await expect(page.locator('#oob-result [data-part="best"]')).toContainText(/^Best move: 1\.\.\.\S+/);
  await expect(page.locator('#oob-result [data-part="line"]')).toContainText('1...');
  await page.screenshot({ path: 'test-results/phase6-stopped.png', fullPage: true });

  // (b) Play on against the weakened Stockfish: it answers, and it is White's turn again.
  await page.locator('#oob-strength').selectOption('medium');
  await page.locator('#oob-play').click();
  await expect(oob(page)).toHaveAttribute('data-state', 'engine');
  await expect(page.locator('#oob-lead')).toHaveText('Playing on against Stockfish (Medium).');
  await expect(page.locator('#moves .move')).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator('#oob-engine')).toHaveText('Your move as White.');
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'white-only');

  // And again after another White move.
  const chess = new Chess(await fen(page));
  const next = chess.moves({ verbose: true }).find((move) => !move.promotion)!;
  await play(page, next.from + next.to);
  await expect(page.locator('#moves .move')).toHaveCount(4, { timeout: 20_000 });

  // New game starts over inside the data.
  await page.locator('#play-new').click();
  await expect(page.locator('#moves .move')).toHaveCount(0);
  await expect(oob(page)).toBeHidden();
  await expect(prompt(page)).toHaveAttribute('data-state', 'your-move');
});

test('a Play game is kept while looking around in Explore', async ({ page }) => {
  await openPlay(page);
  await play(page, whiteMove(await fen(page), 0)!);
  await settled(page);
  const moves = await moveTexts(page);
  expect(moves.length).toBeGreaterThanOrEqual(1);

  await page.locator('#mode-explore').click();
  await expect(page.locator('#explore')).toBeVisible();
  expect(await moveTexts(page)).toEqual(moves);
  await page.locator('#reset').click();
  await expect(page.locator('#moves .move')).toHaveCount(0);

  await page.locator('#mode-play').click();
  expect(await moveTexts(page)).toEqual(moves);
});

test('a drill that runs out of data asks the same question, and can be played on', async ({ page }) => {
  await openApp(page);
  await page.locator('#mode-drill').click();
  const drillPrompt = page.locator('#drill-prompt');
  for (let guard = 0; guard < 30; guard++) {
    await expect
      .poll(async () => {
        const state = await drillPrompt.getAttribute('data-state');
        const interaction = await page.locator('#board').getAttribute('data-interaction');
        return state === 'finished' || (state === 'asking' && interaction === 'white-only');
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
  await page.screenshot({ path: 'test-results/phase6-drill-out.png', fullPage: true });

  const count = (await moveTexts(page)).length;
  await page.locator('#oob-play').click();
  await expect(oob(page)).toHaveAttribute('data-state', 'engine');
  // Whoever is to move, the game goes on: Stockfish moves for Black, then it is White's turn.
  await expect(page.locator('#oob-engine')).toHaveText('Your move as White.', { timeout: 20_000 });
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'white-only');
  expect((await moveTexts(page)).length).toBeGreaterThanOrEqual(count);

  // Enter does not throw the game away; Next line does start a new line.
  await page.keyboard.press('Enter');
  await expect(oob(page)).toHaveAttribute('data-state', 'engine');
  await page.locator('#drill-next').click();
  await expect(oob(page)).toBeHidden();
  await expect(drillPrompt).toHaveAttribute('data-state', /^(asking|finished)$/);
});

test('Play mode fits a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openPlay(page);
  await play(page, firstMoveOutOfData());
  await expect(oob(page)).toBeVisible();
  await page.locator('#oob-stop').click();
  await expect(page.locator('#oob-result [data-part="balance"]')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/phase6-narrow.png', fullPage: true });
});
