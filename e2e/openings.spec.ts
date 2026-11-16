import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { buildRepertoire } from '../src/repertoire/repertoire';
import type { Snapshot } from '../src/snapshot/format';
import { enterDrill, expect, moveTexts, openApp, playMoves, test, tryMove } from './helpers';

const dataFile = (name: string): string => fileURLToPath(new URL(`../src/data/openings/${name}`, import.meta.url));
const readSnapshot = (name: string): Snapshot => JSON.parse(readFileSync(dataFile(name), 'utf8')) as Snapshot;

const ponziani = readSnapshot('ponziani.json');
const ponzianiRepertoire = buildRepertoire(ponziani);
const OPENING_KEY = 'chauss.opening.v1';

const storedOpening = (page: Page) => page.evaluate((key) => localStorage.getItem(key), OPENING_KEY);

test.describe('first visit', () => {
  test.use({ openingSeed: null });

  test('no opening has to be chosen: the board, Explore and the data are there straight away', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#opening-picker')).toHaveCount(0);
    await expect(page.locator('#open-picker')).toHaveCount(0);
    await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
    expect(await storedOpening(page)).toBeNull();

    // Choosing an opening in the Drill hub stores it.
    await enterDrill(page, 'ponziani');
    expect(await storedOpening(page)).toBe('ponziani');
  });

  test('an unknown stored opening is treated as no choice', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'sicilian'), OPENING_KEY);
    await openApp(page);
    await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
  });
});

test('Explore uses the data of every opening, whichever one is drilled', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
  // 1.e4 c6 is only a sideline of the Ponziani, but the root of the Caro-Kann data.
  await playMoves(page, ['e2e4', 'c7c6']);
  await expect(page.locator('#opening-name')).toContainText('Caro-Kann');
  await expect(page.locator('#explore')).toHaveAttribute('data-status', 'ready');
});

test('progress saved by the old version shows up under the Ponziani', async ({ page }) => {
  const card = [...ponzianiRepertoire.cards.values()][0]!;
  const old = { version: 1, cards: { [card.key]: { streak: 1, intervalDays: 1, ease: 2.5, due: Date.now() + 86_400_000, attempts: 4, errors: 1, lastSeen: Date.now() } } };
  await page.addInitScript((value) => {
    if (!localStorage.getItem('chauss.progress.v2')) localStorage.setItem('chauss.progress.v1', JSON.stringify(value));
  }, old);
  await openApp(page);
  // The repertoire is built when the data has loaded; the Statistics table is drawn from it.
  await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
  await enterDrill(page);
  await page.locator('#open-stats').click();
  const row = page.locator(`#stats-table tbody tr[data-key="${card.key}"]`);
  await expect(row.locator('td').nth(2)).toHaveText('4');
  await expect(row.locator('td').nth(3)).toHaveText('1');

  // The new record exists, and the old one was left alone.
  const stored = await page.evaluate(() => ({
    v1: localStorage.getItem('chauss.progress.v1'),
    v2: JSON.parse(localStorage.getItem('chauss.progress.v2') ?? 'null') as { version: number; openings: Record<string, { cards: Record<string, unknown> }> } | null,
  }));
  expect(JSON.parse(stored.v1!)).toEqual(old);
  expect(stored.v2?.version).toBe(2);
  expect(stored.v2?.openings.ponziani?.cards[card.key]).toMatchObject({ attempts: 4, errors: 1 });

  // Save a backup: it holds the version-2 record; loading an old-style file maps to the Ponziani.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#stats-export').click();
  const backup = JSON.parse(readFileSync((await (await downloadPromise).path())!, 'utf8')) as {
    progress: { version: number; openings: Record<string, { cards: Record<string, unknown> }> };
  };
  expect(backup.progress.version).toBe(2);
  expect(Object.keys(backup.progress.openings)).toEqual(['ponziani']);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#stats-reset').click();
  await expect(page.locator('#stats-message')).toHaveText('Progress for the Ponziani reset.');
  await expect(row.locator('td').nth(2)).toHaveText('–');

  await page.locator('#stats-import-file').setInputFiles({
    name: 'old-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'chauss', exportedAt: '2026-11-13T12:00:00.000Z', progress: old })),
  });
  await expect(page.locator('#stats-message')).toHaveText('Backup loaded: progress for 1 position.');
  await expect(row.locator('td').nth(2)).toHaveText('4');
});

const hasCaroKann = existsSync(dataFile('caro-kann.json'));

test.describe('Caro-Kann (playing Black)', () => {
  test.skip(!hasCaroKann, 'the Caro-Kann data has not been built yet');
  const caro = hasCaroKann ? readSnapshot('caro-kann.json') : null;
  const caroRepertoire = caro ? buildRepertoire(caro) : null;
  const first = caroRepertoire ? [...caroRepertoire.cards.values()].find((card) => card.line.length === 1)! : null;

  test.use({ openingSeed: 'caro-kann' });

  test('the board turns to Black and the drill plays 1.e4, then asks for 1...c6', async ({ page }) => {
    await openApp(page);
    // Explore is not tied to an opening: White at the bottom.
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
    await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
    await page.screenshot({ path: 'test-results/openings-caro-kann-explore.png', fullPage: true });

    await enterDrill(page);
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
    await expect(page.locator('#drill-prompt')).toHaveAttribute('data-state', 'asking');
    await expect(page.locator('#drill-prompt')).toContainText('Your move as Black');
    await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'player-only');
    await expect.poll(async () => (await moveTexts(page)).length).toBeGreaterThan(0);
    expect((await moveTexts(page))[0]).toBe('e4');
    await page.screenshot({ path: 'test-results/openings-caro-kann-drill.png', fullPage: true });
    expect(first?.move.san).toBe('c6');
  });

  test('1...c6 is accepted; another move shows the correct one', async ({ page }) => {
    await openApp(page);
    await enterDrill(page);
    await expect(page.locator('#drill-prompt')).toHaveAttribute('data-state', 'asking');
    // The drill may aim at a deeper line; the first move is always 1.e4 and then 1...c6 is asked.
    await expect(page.locator('#moves .move')).toHaveCount(1);
    await expect(page.locator('#board')).toHaveAttribute('data-your-turn', 'true');

    // A wrong move first.
    await tryMove(page, 'b7', 'b6');
    await expect(page.locator('#drill-feedback')).toHaveAttribute('data-kind', 'wrong');
    await expect(page.locator('#drill-feedback')).toContainText('The repertoire move is c6');

    await tryMove(page, 'c7', 'c6');
    await expect(page.locator('#drill-feedback')).toHaveAttribute('data-kind', 'correct');
    await expect(page.locator('#moves .move').nth(1)).toHaveText('c6');
  });

  test('switching back to the Ponziani turns the board and keeps each opening separate', async ({ page }) => {
    await openApp(page);
    // Switching is done in the Drill hub; it reloads the page straight into the Ponziani drill.
    // (Let everything finish loading first — Stockfish, the hub's little boards — so the reload cuts
    // no download short.)
    await expect(page.locator('#engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await page.locator('#mode-drill').click();
    await page.locator('#drill-hub [data-category="openings"]').click();
    await page.waitForLoadState('networkidle');
    await page.locator('#drill-hub [data-entry="ponziani"]').click();
    await expect(page.locator('#mode-drill')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('cg-board piece')).not.toHaveCount(0);
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
    expect(await storedOpening(page)).toBe('ponziani');
    await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
    await page.locator('#open-stats').click();
    await expect(page.locator('#stats-table tbody tr')).toHaveCount(ponzianiRepertoire.cards.size);
  });
});
