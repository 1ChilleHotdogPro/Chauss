import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { buildRepertoire } from '../src/repertoire/repertoire';
import type { Snapshot } from '../src/snapshot/format';
import { expect, moveTexts, openApp, test, tryMove } from './helpers';

const dataFile = (name: string): string => fileURLToPath(new URL(`../src/data/openings/${name}`, import.meta.url));
const readSnapshot = (name: string): Snapshot => JSON.parse(readFileSync(dataFile(name), 'utf8')) as Snapshot;

const ponziani = readSnapshot('ponziani.json');
const ponzianiRepertoire = buildRepertoire(ponziani);
const OPENING_KEY = 'chauss.opening.v1';

const picker = (page: Page) => page.locator('#opening-picker');
const header = (page: Page) => page.locator('#open-picker');
const choose = (page: Page, id: string) => picker(page).locator(`.opening-choice[data-opening="${id}"]`).click();
const storedOpening = (page: Page) => page.evaluate((key) => localStorage.getItem(key), OPENING_KEY);

test.describe('first visit', () => {
  test.use({ openingSeed: null });

  test('the picker asks which opening to learn, and nothing loads until you choose', async ({ page }) => {
    const dataRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/assets\/.*\.json/.test(request.url())) dataRequests.push(request.url());
    });
    await page.goto('./');
    await expect(picker(page)).toBeVisible();
    await expect(picker(page).locator('.opening-choice')).toHaveCount(2);
    await expect(picker(page).locator('.opening-choice[data-opening="ponziani"]')).toContainText('You play White');
    await expect(picker(page).locator('.opening-choice[data-opening="ponziani"]')).toContainText('1.e4 e5 2.Nf3 Nc6 3.c3');
    await expect(picker(page).locator('.opening-choice[data-opening="caro-kann"]')).toContainText('You play Black');
    await expect(picker(page).locator('.opening-choice[data-opening="caro-kann"]')).toContainText('1.e4 c6');
    await expect(header(page)).toHaveText('Choose an opening ▾');
    await expect(picker(page).locator('#opening-close')).toBeHidden();
    await page.screenshot({ path: 'test-results/openings-picker.png', fullPage: true });

    // It cannot be dismissed with Escape, and the board hotkeys are off while it is open.
    await page.keyboard.press('Escape');
    await expect(picker(page)).toBeVisible();
    await page.keyboard.press('f');
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
    expect(dataRequests).toEqual([]);

    // Choosing stores the opening and loads its data.
    await choose(page, 'ponziani');
    await expect(page.locator('cg-board piece')).toHaveCount(32);
    await expect(picker(page)).toBeHidden();
    await expect(header(page)).toHaveText('Ponziani · White ▾');
    expect(await storedOpening(page)).toBe('ponziani');
    await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
  });

  test('an unknown stored opening is treated as no choice', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'sicilian'), OPENING_KEY);
    await page.goto('./');
    await expect(picker(page)).toBeVisible();
  });
});

test('the header button shows the opening and switches to another', async ({ page }) => {
  await openApp(page);
  await expect(header(page)).toHaveText('Ponziani · White ▾');
  await expect(picker(page)).toBeHidden();

  await header(page).click();
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).locator('.opening-choice[data-opening="ponziani"]')).toHaveAttribute('aria-current', 'true');
  // Choosing the opening you are already in just closes the picker.
  await choose(page, 'ponziani');
  await expect(picker(page)).toBeHidden();
  await header(page).click();
  await picker(page).locator('#opening-close').click();
  await expect(picker(page)).toBeHidden();
});

test('progress saved by the old version shows up under the Ponziani', async ({ page }) => {
  const card = [...ponzianiRepertoire.cards.values()][0]!;
  const old = { version: 1, cards: { [card.key]: { streak: 1, intervalDays: 1, ease: 2.5, due: Date.now() + 86_400_000, attempts: 4, errors: 1, lastSeen: Date.now() } } };
  await page.addInitScript((value) => {
    if (!localStorage.getItem('chauss.progress.v2')) localStorage.setItem('chauss.progress.v1', JSON.stringify(value));
  }, old);
  await openApp(page);
  await page.locator('#mode-drill').click(); // the Statistics button lives in the Drill panel
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
    await expect(header(page)).toHaveText('Caro-Kann · Black ▾');
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
    await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
    await page.screenshot({ path: 'test-results/openings-caro-kann-explore.png', fullPage: true });

    await page.locator('#mode-drill').click();
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
    await page.locator('#mode-drill').click();
    await expect(page.locator('#drill-prompt')).toHaveAttribute('data-state', 'asking');
    // The drill may aim at a deeper line; the first move is always 1.e4 and then 1...c6 is asked.
    await expect(page.locator('#moves .move')).toHaveCount(1);

    // A wrong move first.
    await tryMove(page, 'b7', 'b6');
    await expect(page.locator('#drill-feedback')).toHaveAttribute('data-kind', 'wrong');
    await expect(page.locator('#drill-feedback')).toContainText('The repertoire move is c6');

    await tryMove(page, 'c7', 'c6');
    await expect(page.locator('#drill-feedback')).toHaveAttribute('data-kind', 'correct');
    await expect(page.locator('#moves .move').nth(1)).toHaveText('c6');
  });

  test('in Play the bot has White and moves first', async ({ page }) => {
    await openApp(page);
    await page.locator('#mode-play').click();
    await expect(page.locator('#play-prompt')).toHaveAttribute('data-state', 'your-move', { timeout: 10_000 });
    await expect(page.locator('#play-prompt')).toContainText('Your move as Black');
    await expect(page.locator('#moves .move')).toHaveCount(1);
    await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'player-only');
    await expect(page.locator('#play-last')).toContainText('White played');
  });

  test('switching back to the Ponziani turns the board and keeps each opening separate', async ({ page }) => {
    await openApp(page);
    await header(page).click();
    await choose(page, 'ponziani');
    await expect(page.locator('cg-board piece')).toHaveCount(32);
    await expect(header(page)).toHaveText('Ponziani · White ▾');
    await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
    expect(await storedOpening(page)).toBe('ponziani');
    await page.locator('#mode-drill').click();
    await page.locator('#open-stats').click();
    await expect(page.locator('#stats-table tbody tr')).toHaveCount(ponzianiRepertoire.cards.size);
  });
});
