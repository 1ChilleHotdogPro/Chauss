import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Request } from '@playwright/test';
import { Chess } from 'chess.js';
import { buildExplorePosition, type ExplorePosition } from '../src/explore/position';
import type { TrapFile } from '../src/explore/traps';
import { positionKey, type Snapshot } from '../src/snapshot/format';
import { compactNumber, sharePercent } from '../src/ui/explorePanel';
import { expect, moveTexts, openApp, playMoves, test } from './helpers';

// The tests read the bundled data themselves, so they check that the screen shows what the files
// say — whatever the numbers are after the next re-crawl.
const read = <T>(file: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../src/data/${file}`, import.meta.url)), 'utf8')) as T;
const snapshot = read<Snapshot>('ponziani.json');
const trapFile = read<TrapFile>('traps.json');

const PONZIANI_MOVES = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3'];
const FAKE_TOKEN = 'lip_testTokenNotReal123';

/** What the snapshot says about the position after some moves (engine spelling). */
function positionAfter(uciMoves: readonly string[]): ExplorePosition {
  const chess = new Chess();
  for (const uci of uciMoves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const node = snapshot.nodes[positionKey(chess.fen())];
  if (!node) throw new Error(`the snapshot has no position after ${uciMoves.join(' ')}`);
  return buildExplorePosition(node);
}

const explore = (page: Page) => page.locator('#explore');
const rows = (page: Page, table: 'book' | 'popular') => page.locator(`#${table}-moves tbody tr`);

async function exploreReady(page: Page): Promise<void> {
  await expect(explore(page)).toHaveAttribute('data-status', 'ready');
}

test('the Ponziani position shows its name and both move lists with the bundled numbers', async ({ page }) => {
  await openApp(page);
  await playMoves(page, PONZIANI_MOVES);
  await exploreReady(page);
  await expect(explore(page)).toHaveAttribute('data-origin', 'snapshot');

  const expected = positionAfter(PONZIANI_MOVES);
  await expect(page.locator('#opening-name')).toContainText('Ponziani Opening');
  await expect(page.locator('#opening-name .opening-eco')).toHaveText(expected.opening!.eco);

  // Book and Popular are two separate tables, each in its own order.
  await expect(rows(page, 'book')).toHaveCount(expected.bookMoves.length);
  await expect(rows(page, 'popular')).toHaveCount(expected.popularMoves.length);
  expect(await rows(page, 'book').locator('.explore-move').allTextContents()).toEqual(expected.bookMoves.map((m) => m.san));
  expect(await rows(page, 'popular').locator('.explore-move').allTextContents()).toEqual(
    expected.popularMoves.map((m) => m.san),
  );

  // The first row of each table carries that source's own numbers.
  const topPopular = expected.popularMoves[0]!;
  const popularRow = rows(page, 'popular').first();
  await expect(popularRow.locator('.explore-share')).toHaveText(sharePercent(topPopular.popular!.share));
  await expect(popularRow.locator('.explore-games')).toHaveText(compactNumber(topPopular.popular!.games));
  await expect(popularRow.locator('.results-bar')).toHaveAttribute(
    'title',
    `White wins ${topPopular.popular!.whitePercent}% · draws ${topPopular.popular!.drawPercent}% · Black wins ${topPopular.popular!.blackPercent}%`,
  );
  const topBook = expected.bookMoves[0]!;
  const bookRow = rows(page, 'book').first();
  await expect(bookRow.locator('.explore-share')).toHaveText(sharePercent(topBook.book!.share));
  await expect(bookRow.locator('.explore-games')).toHaveText(compactNumber(topBook.book!.games));

  // Headings say which is which, with the totals.
  await expect(explore(page).locator('h3').nth(0)).toHaveText(`Book — master games (${compactNumber(expected.bookGames)})`);
  await expect(explore(page).locator('h3').nth(1)).toContainText('Popular at your level — Lichess 1000-1399');

  // A move no master has played is in the popular list only.
  const amateurOnly = expected.popularMoves.find((m) => m.book === null);
  if (amateurOnly) {
    await expect(page.locator(`#popular-moves tr[data-uci="${amateurOnly.uci}"]`)).toHaveCount(1);
    await expect(page.locator(`#book-moves tr[data-uci="${amateurOnly.uci}"]`)).toHaveCount(0);
  }
  await page.screenshot({ path: 'test-results/phase4-ponziani.png', fullPage: true });
});

test('clicking a move in a table plays it and the panel follows', async ({ page }) => {
  await openApp(page);
  await exploreReady(page);

  // From the start position, click through the opening using the Popular table.
  for (const [index, uci] of PONZIANI_MOVES.entries()) {
    await page.locator(`#popular-moves tr[data-uci="${uci}"] .explore-move`).click();
    await expect(page.locator('#moves .move')).toHaveCount(index + 1);
  }
  expect(await moveTexts(page)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'c3']);
  await expect(page.locator('#opening-name')).toContainText('Ponziani Opening');

  // Going back shows the earlier position's data again.
  await page.keyboard.press('ArrowLeft');
  const before = positionAfter(PONZIANI_MOVES.slice(0, 4));
  await expect(rows(page, 'popular').first().locator('.explore-move')).toHaveText(before.popularMoves[0]!.san);
});

test('Stockfish scores in the tables stay hidden until the eval is switched on', async ({ page }) => {
  await openApp(page);
  await playMoves(page, PONZIANI_MOVES);
  await exploreReady(page);
  await expect(page.locator('#popular-moves .explore-eval')).toHaveCount(0);
  await expect(page.locator('#popular-moves th')).toHaveCount(5);

  await page.keyboard.press('e');
  const expected = positionAfter(PONZIANI_MOVES);
  await expect(page.locator('#popular-moves .explore-eval')).toHaveCount(expected.popularMoves.length);
  await expect(page.locator('#popular-moves .explore-eval').first()).toHaveText(/^([+-]\d+\.\d|0\.0|#-?\d*)$/);

  await page.keyboard.press('e');
  await expect(page.locator('#popular-moves .explore-eval')).toHaveCount(0);
});

test('a flagged move explains itself: best reply, line and reason from Stockfish', async ({ page }) => {
  // Find a flagged move in the bundled data: the first trap is one by construction.
  const trap = trapFile.traps.find((candidate) => candidate.kind === 'exploit') ?? trapFile.traps[0];
  test.skip(!trap, 'the bundled data has no traps');
  if (!trap) return;

  await openApp(page);
  // Reach the trap's position by clicking its moves in the Popular table.
  for (const san of trap.line) {
    await page.locator('#popular-moves .explore-move', { hasText: new RegExp(`^${san.replace(/[+#]/g, '\\$&')}$`) }).first().click();
  }
  await exploreReady(page);

  const row = page.locator(`#popular-moves tr[data-uci="${trap.move.uci}"]`);
  await expect(row).toHaveAttribute('data-flag', /^(mistake|blunder)$/);
  const flag = row.locator('.flag');
  await expect(flag).toHaveText(/^\?\??$/);
  await expect(page.locator('#refutation')).toHaveCount(0);

  await flag.click();
  const box = page.locator('#refutation');
  await expect(box).toBeVisible();
  await expect(box.locator('.refutation-title')).toContainText(`${trap.move.san}?`);
  await expect(box.locator('.refutation-title')).toContainText(/Played in (<1|\d+)% of games at this level/);
  await expect(row).toHaveClass(/selected/);

  // Stockfish works it out live; the bundled trap list was made with the same engine.
  await expect(box).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await expect(box.locator('.refutation-reply')).toHaveText(/^\S+$/);
  await expect(box.locator('.refutation-line .line-moves')).toHaveText(/^\d+\.(\.\.)? \S+/);
  await expect(box).toContainText(/wins|checkmate|Stockfish rates the position/);
  await page.screenshot({ path: 'test-results/phase4-refutation.png', fullPage: true });

  // Closing, and moving on, both remove the explanation.
  await box.locator('.refutation-close').click();
  await expect(page.locator('#refutation')).toHaveCount(0);
  await flag.click();
  await expect(page.locator('#refutation')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#refutation')).toHaveCount(0);
});

test('every legal move can be ranked by Stockfish', async ({ page }) => {
  await openApp(page);
  await playMoves(page, PONZIANI_MOVES);
  await exploreReady(page);
  await expect(page.locator('#ranking-list')).toHaveCount(0);

  await page.locator('#toggle-ranking').click();
  await expect(page.locator('#toggle-ranking')).toHaveAttribute('aria-pressed', 'true');
  const items = page.locator('#ranking-list li');
  const legalMoves = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3').moves().length;
  await expect(items).toHaveCount(legalMoves, { timeout: 60_000 });

  // Most punished first: the top of the list is flagged, the bottom is not.
  await expect(items.first()).toHaveAttribute('data-flag', /^(mistake|blunder)$/);
  await expect(items.last()).toHaveAttribute('data-flag', 'none');

  // Clicking a ranked move plays it; the ranking belongs to the old position and goes away.
  const lastSan = (await items.last().locator('.explore-move').textContent())!;
  await items.last().locator('.explore-move').click();
  expect((await moveTexts(page)).at(-1)).toBe(lastSan);
  await expect(page.locator('#ranking-list')).toHaveCount(0);
  await expect(page.locator('#toggle-ranking')).toHaveAttribute('aria-pressed', 'false');
});

test('the list of common mistakes opens, and "Show on the board" jumps to the position', async ({ page }) => {
  await openApp(page);
  const button = page.locator('#open-traps');
  await expect(button).toHaveText(`Common mistakes in this opening (${trapFile.traps.length})`);
  await button.click();
  await expect(page.locator('#traps')).toBeVisible();
  await expect(page.locator('#traps .trap')).toHaveCount(trapFile.traps.length);

  const exploit = trapFile.traps.filter((t) => t.kind === 'exploit');
  const avoid = trapFile.traps.filter((t) => t.kind === 'avoid');
  await expect(page.locator('#traps-exploit .trap')).toHaveCount(exploit.length);
  await expect(page.locator('#traps-avoid .trap')).toHaveCount(avoid.length);

  const trap = trapFile.traps[0];
  test.skip(!trap, 'the bundled data has no traps');
  if (!trap) return;
  const item = page.locator(`#traps .trap[data-id="${trap.id}"]`);
  await expect(item.locator('.trap-title')).toContainText(trap.move.san);
  await expect(item.locator('.trap-punish')).toContainText(trap.refutation.why);
  await expect(item.locator('.trap-punish')).toContainText(trap.refutation.san[0]!);
  await page.screenshot({ path: 'test-results/phase4-traps.png' });

  await item.locator('.trap-show').click();
  await expect(page.locator('#traps')).toBeHidden();
  expect(await moveTexts(page)).toEqual(trap.line);
  await expect(page.locator('#fen')).toHaveText(trap.fen);
  // The bad move's explanation is opened straight away.
  await expect(page.locator('#refutation .refutation-title')).toContainText(trap.move.san);
});

test('outside the bundled data, without a token, the panel says what to do', async ({ page }) => {
  const requests: Request[] = [];
  await page.route('https://explorer.lichess.org/**', (route) => {
    requests.push(route.request());
    return route.abort();
  });
  await openApp(page);
  await playMoves(page, ['d2d4', 'd7d5', 'c2c4']);
  await expect(explore(page)).toHaveAttribute('data-status', 'unavailable');
  await expect(page.locator('#explore-unavailable')).toHaveText(
    /outside the bundled opening data\. Add a Lichess token in Settings/,
  );
  // The engine still works there.
  await expect(page.locator('#toggle-ranking')).toBeVisible();
  expect(requests).toHaveLength(0);
});

test('outside the bundled data, with a token, the panel shows live data', async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem(
      'chauss.settings.v1',
      JSON.stringify({ version: 1, token, ratings: [1000, 1200], speeds: ['blitz', 'rapid', 'classical'] }),
    );
  }, FAKE_TOKEN);

  const requests: Request[] = [];
  await page.route('https://explorer.lichess.org/**', async (route) => {
    requests.push(route.request());
    const masters = new URL(route.request().url()).pathname === '/masters';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        white: masters ? 40 : 600,
        draws: masters ? 40 : 50,
        black: masters ? 20 : 350,
        opening: { eco: 'D00', name: "Queen's Pawn Game" },
        moves: [
          { uci: 'd7d5', san: 'd5', averageRating: 1200, white: masters ? 30 : 400, draws: masters ? 30 : 30, black: masters ? 10 : 170, game: null, opening: null },
          { uci: 'g8f6', san: 'Nf6', averageRating: 1200, white: masters ? 10 : 200, draws: masters ? 10 : 20, black: masters ? 10 : 180, game: null, opening: null },
        ],
      }),
    });
  });

  await openApp(page);
  // Inside the bundled data nothing is fetched, token or not.
  await exploreReady(page);
  await expect(explore(page)).toHaveAttribute('data-origin', 'snapshot');
  expect(requests).toHaveLength(0);

  await playMoves(page, ['d2d4']);
  await expect(explore(page)).toHaveAttribute('data-origin', 'live');
  await expect(page.locator('#opening-name')).toContainText("Queen's Pawn Game");
  expect(await rows(page, 'popular').locator('.explore-move').allTextContents()).toEqual(['d5', 'Nf6']);
  await expect(rows(page, 'popular').first().locator('.explore-share')).toHaveText('60%');
  await expect(rows(page, 'book').first().locator('.explore-games')).toHaveText('70');
  await expect(explore(page).locator('.explore-origin')).toHaveText('Live data from Lichess.');

  const gets = requests.filter((request) => request.method() === 'GET');
  expect(gets.map((request) => new URL(request.url()).pathname)).toEqual(['/masters', '/lichess']);
  for (const request of gets) {
    expect(request.headers().authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(request.url()).not.toContain(FAKE_TOKEN);
  }
});

test('choosing other rating groups without a token keeps the bundled data and says so', async ({ page }) => {
  await openApp(page);
  await playMoves(page, PONZIANI_MOVES);
  await exploreReady(page);
  await expect(page.locator('#explore-note')).toHaveCount(0);

  await page.locator('#open-settings').click();
  await page.locator('#settings input[name="rating"][value="1600"]').check();
  await page.locator('#settings-close').click();

  await expect(page.locator('#explore-note')).toHaveText(
    /no Lichess token is set\. Showing the bundled data instead \(Lichess games rated 1000-1399\)/,
  );
  await expect(explore(page)).toHaveAttribute('data-origin', 'snapshot');
  await expect(rows(page, 'popular')).not.toHaveCount(0);
});

test('Settings describes the bundled data', async ({ page }) => {
  const assets: { url: string; status: number }[] = [];
  page.on('response', (response) => {
    if (/ponziani|traps/.test(response.url())) assets.push({ url: response.url(), status: response.status() });
  });
  await openApp(page);
  await page.locator('#open-settings').click();
  const info = page.locator('#snapshot-info');
  await expect(info).toHaveAttribute('data-state', 'ready');
  await expect(info).toHaveAttribute('data-positions', String(snapshot.meta.counts.positions));
  await expect(info).toContainText(`${snapshot.meta.counts.positions.toLocaleString('en-US')} positions`);
  await expect(info).toContainText('Lichess games rated 1000-1399');
  await expect(info).toContainText(`Scores by ${snapshot.meta.engine.name} at depth ${snapshot.meta.engine.depth}`);

  // Both data files are served from under /Chauss/ as files of their own.
  expect(assets.length).toBeGreaterThanOrEqual(2);
  for (const asset of assets) {
    expect(asset.status).toBe(200);
    expect(new URL(asset.url).pathname).toMatch(/^\/Chauss\/assets\/(ponziani|traps)-.+\.json$/);
  }
});

test('the Explore panel fits a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openApp(page);
  await playMoves(page, PONZIANI_MOVES);
  await exploreReady(page);
  await page.keyboard.press('e');
  await expect(page.locator('#popular-moves .explore-eval').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#popular-moves').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/phase4-narrow.png', fullPage: true });
});
