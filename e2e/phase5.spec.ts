import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { importProgress, PROGRESS_STORAGE_KEY, type Progress } from '../src/drill/progress';
import { pickTarget } from '../src/drill/select';
import { buildRepertoire, type Card } from '../src/repertoire/repertoire';
import { positionKey, type Snapshot } from '../src/snapshot/format';
import { expect, moveTexts, openApp, test, tryMove } from './helpers';

// The tests work out the repertoire from the bundled data the same way the app does, so they
// keep working after the data is rebuilt.
const snapshot = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/ponziani.json', import.meta.url)), 'utf8'),
) as Snapshot;
const repertoire = buildRepertoire(snapshot);
const totalCards = repertoire.cards.size;
/** The card the very first drill aims at. */
const firstTarget = pickTarget(repertoire.cards.values(), { version: 1, cards: {} }, Date.now())!.card;

const prompt = (page: Page) => page.locator('#drill-prompt');
const feedback = (page: Page) => page.locator('#drill-feedback');
const counts = (page: Page) => page.locator('#drill-counts');

async function startDrill(page: Page): Promise<void> {
  await openApp(page);
  await page.locator('#mode-drill').click();
  await expect(page.locator('#mode-drill')).toHaveAttribute('aria-selected', 'true');
  await ready(page);
}

/** Wait until it is the user's turn in the drill. */
async function ready(page: Page): Promise<void> {
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'white-only');
  await expect(prompt(page)).toHaveAttribute('data-state', 'asking');
}

/** The card for the position on the board. */
async function currentCard(page: Page): Promise<Card> {
  const fen = (await page.locator('#fen').textContent())!;
  const card = repertoire.cards.get(positionKey(fen));
  if (!card) throw new Error(`no card for ${fen}`);
  return card;
}

const play = (page: Page, uci: string) => tryMove(page, uci.slice(0, 2), uci.slice(2, 4));

/** A legal White move in the card's position that is not the repertoire move (a quiet pawn move if possible). */
function wrongMove(card: Card): { uci: string; san: string } {
  const moves = new Chess(card.fen).moves({ verbose: true }).filter((m) => m.from + m.to !== card.move.uci && !m.promotion);
  const quiet = moves.find((m) => m.piece === 'p' && !m.captured && m.from[0] === 'a') ?? moves[0]!;
  return { uci: quiet.from + quiet.to, san: quiet.san };
}

const storedProgress = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as Progress | null, PROGRESS_STORAGE_KEY);

test('Drill mode sets up the first line and hides the answers', async ({ page }) => {
  await startDrill(page);

  // The app has played the opening and Black's replies up to the first card.
  expect(await moveTexts(page)).toEqual(firstTarget.line);
  await expect(page.locator('#fen')).toHaveText(firstTarget.fen);
  await expect(prompt(page)).toContainText('Your move as White');
  await expect(prompt(page)).toContainText('A new line.');
  await expect(counts(page)).toHaveAttribute('data-total', String(totalCards));
  await expect(counts(page)).toHaveAttribute('data-new', String(totalCards));
  await expect(counts(page)).toHaveAttribute('data-due', '0');
  await expect(feedback(page)).toBeHidden();

  // Nothing that gives the answer away is on screen.
  for (const hidden of ['#explore', '#toggle-eval', '#toggle-arrows', '#engine-status', '#open-traps', '#undo', '#reset', '#prev', '#next']) {
    await expect(page.locator(hidden)).toBeHidden();
  }
  await expect(page.locator('#evalbar')).toBeHidden();
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '0');
  await expect(page.locator('#flip')).toBeVisible();

  // Hotkeys for the evaluation and for stepping back do nothing here.
  await page.keyboard.press('e');
  await page.keyboard.press('a');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#evalbar')).toBeHidden();
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '0');
  expect(await moveTexts(page)).toEqual(firstTarget.line);
  await page.screenshot({ path: 'test-results/phase5-drill.png', fullPage: true });
});

test('a right answer is confirmed, recorded, and Black replies', async ({ page }) => {
  await startDrill(page);
  const card = await currentCard(page);
  await play(page, card.move.uci);

  await expect(feedback(page)).toHaveAttribute('data-kind', 'correct');
  await expect(feedback(page)).toHaveText(`${card.move.san} — correct.`);
  await expect(page.locator('#drill-score')).toHaveText('This sitting: 1 of 1 right first time.');

  // Our move is in the list; unless the line ended there, so is Black's reply.
  const moves = await moveTexts(page);
  expect(moves.slice(0, card.line.length + 1)).toEqual([...card.line, card.move.san]);
  await expect(prompt(page)).toHaveAttribute('data-state', /^(asking|finished)$/);

  // Stored in this browser at once.
  const progress = await storedProgress(page);
  expect(progress?.cards[card.key]).toMatchObject({ attempts: 1, errors: 0, streak: 1 });
  await expect(counts(page)).toHaveAttribute('data-new', String(totalCards - 1));
});

test('a wrong answer shows the repertoire move and the reason, and is counted once', async ({ page }) => {
  await startDrill(page);
  const card = await currentCard(page);
  const wrong = wrongMove(card);

  await play(page, wrong.uci);
  await expect(feedback(page)).toHaveAttribute('data-kind', 'wrong');
  await expect(feedback(page)).toContainText(`${wrong.san} is`);
  await expect(feedback(page)).toContainText(`The repertoire move is ${card.move.san}.`);
  await expect(feedback(page)).toContainText('Play it to continue.');

  // The wrong move was taken back, and an arrow shows the right one.
  await expect(page.locator('#fen')).toHaveText(card.fen);
  expect(await moveTexts(page)).toEqual(card.line);
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '1');
  await expect(page.locator('.cg-wrap svg.cg-shapes g[cgHash]')).toHaveCount(1);
  expect((await storedProgress(page))?.cards[card.key]).toMatchObject({ attempts: 1, errors: 1 });
  await page.screenshot({ path: 'test-results/phase5-wrong.png', fullPage: true });

  // A second wrong try is not counted again.
  await play(page, wrong.uci);
  await expect(feedback(page)).toHaveAttribute('data-kind', 'wrong');
  expect((await storedProgress(page))?.cards[card.key]).toMatchObject({ attempts: 1, errors: 1 });

  // Playing the repertoire move continues the line.
  await play(page, card.move.uci);
  await expect(feedback(page)).toHaveText(`${card.move.san} — that is the one.`);
  await expect(page.locator('#board')).toHaveAttribute('data-arrows', '0');
  expect((await storedProgress(page))?.cards[card.key]).toMatchObject({ attempts: 1, errors: 1 });
  await expect(page.locator('#drill-score')).toHaveText('This sitting: 0 of 1 right first time.');
});

test("Black's pieces cannot be moved by hand in a drill", async ({ page }) => {
  await startDrill(page);
  const card = await currentCard(page);
  // Try a Black pawn move: nothing happens, and it is not counted as an answer.
  await tryMove(page, 'a7', 'a6');
  await tryMove(page, 'h7', 'h5');
  await expect(page.locator('#fen')).toHaveText(card.fen);
  await expect(feedback(page)).toBeHidden();
  expect(await storedProgress(page)).toBeNull();
});

test('a line can be played to its end, and Enter starts the next one', async ({ page }) => {
  await startDrill(page);

  let asked = 0;
  for (let guard = 0; guard < 30; guard++) {
    if ((await prompt(page).getAttribute('data-state')) !== 'asking') break;
    const card = await currentCard(page);
    await play(page, card.move.uci);
    asked += 1;
    // Wait for the app to show Black's reply (or the end of the line).
    await expect(page.locator('#drill-score')).toHaveText(`This sitting: ${asked} of ${asked} right first time.`);
    await expect
      .poll(async () => {
        const state = await prompt(page).getAttribute('data-state');
        const interaction = await page.locator('#board').getAttribute('data-interaction');
        return state === 'finished' || (state === 'asking' && interaction === 'white-only');
      })
      .toBe(true);
  }

  await expect(prompt(page)).toHaveAttribute('data-state', 'finished');
  await expect(prompt(page)).toHaveText(`End of this line: ${asked} of ${asked} right first time. Press Next line (or Enter).`);
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'none');
  expect(asked).toBeGreaterThanOrEqual(1);

  // Enter starts the next line (even though the focus is still on the Drill tab).
  await page.keyboard.press('Enter');
  await ready(page);
  await expect(feedback(page)).toBeHidden();
  await expect(prompt(page)).toContainText('Your move as White');
  // Enter in the middle of a line does nothing.
  const during = await moveTexts(page);
  await page.keyboard.press('Enter');
  expect(await moveTexts(page)).toEqual(during);

  // The button does the same.
  await page.locator('#drill-next').click();
  await ready(page);
});

test('progress survives a reload', async ({ page }) => {
  await startDrill(page);
  const card = await currentCard(page);
  await play(page, card.move.uci);
  await expect(feedback(page)).toHaveAttribute('data-kind', 'correct');

  await expect(page.locator('#engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.reload();
  await expect(page.locator('cg-board piece')).toHaveCount(32);
  await page.locator('#mode-drill').click();
  await ready(page);
  await expect(counts(page)).toHaveAttribute('data-new', String(totalCards - 1));
  await expect(counts(page)).toHaveAttribute('data-due', '0');
  // The card just answered is not due yet, so the drill aims at another, new one.
  await expect(prompt(page)).toContainText('A new line.');
  expect((await storedProgress(page))?.cards[card.key]).toMatchObject({ attempts: 1, errors: 0 });
});

test('Statistics lists every position; a backup can be saved, and loaded after a reset', async ({ page }) => {
  await startDrill(page);
  const card = await currentCard(page);
  const wrong = wrongMove(card);
  await play(page, wrong.uci);
  await play(page, card.move.uci);
  await expect(feedback(page)).toHaveAttribute('data-kind', 'correct');

  await page.locator('#open-stats').click();
  await expect(page.locator('#stats')).toBeVisible();
  const rows = page.locator('#stats-table tbody tr');
  await expect(rows).toHaveCount(totalCards);
  await expect(page.locator('#stats-summary')).toContainText(`of ${totalCards} positions tried`);

  // The card that was missed is the weakest, so it comes first.
  const first = rows.first();
  await expect(first).toHaveAttribute('data-key', card.key);
  await expect(first.locator('td').nth(1)).toHaveText(card.move.san);
  await expect(first.locator('td').nth(2)).toHaveText('1');
  await expect(first.locator('td').nth(3)).toHaveText('1');
  await expect(first.locator('td').nth(4)).toHaveText('0%');
  await expect(first.locator('td').nth(5)).toHaveText(/^in \d+ minutes?$/);
  await page.screenshot({ path: 'test-results/phase5-stats.png' });

  // Save a backup file.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#stats-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^chauss-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await download.path();
  const backupText = readFileSync(backupPath, 'utf8');
  const parsed = importProgress(backupText);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.progress.cards[card.key]).toMatchObject({ attempts: 1, errors: 1 });

  // Reset (after confirming) empties everything.
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#stats-reset').click();
  await expect(page.locator('#stats-message')).toHaveText('Progress reset.');
  await expect(first.locator('td').nth(2)).toHaveText('–');
  expect((await storedProgress(page))?.cards).toEqual({});

  // A file that is not a backup is refused with an explanation.
  await page.locator('#stats-import-file').setInputFiles({
    name: 'holiday.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"photos": 12}'),
  });
  await expect(page.locator('#stats-message')).toHaveText('This is not a Chauss backup file.');
  await expect(page.locator('#stats-message')).toHaveAttribute('data-status', 'error');

  // Loading the backup brings the progress back.
  await page.locator('#stats-import-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupText),
  });
  await expect(page.locator('#stats-message')).toHaveText('Backup loaded: progress for 1 position.');
  await expect(rows.first()).toHaveAttribute('data-key', card.key);
  await expect(rows.first().locator('td').nth(3)).toHaveText('1');
  expect((await storedProgress(page))?.cards[card.key]).toMatchObject({ attempts: 1, errors: 1 });

  await page.locator('#stats-close').click();
  await expect(counts(page)).toHaveAttribute('data-new', String(totalCards - 1));
});

test('declining the reset question keeps the progress', async ({ page }) => {
  await startDrill(page);
  const card = await currentCard(page);
  await play(page, card.move.uci);
  await expect(feedback(page)).toHaveAttribute('data-kind', 'correct');

  await page.locator('#open-stats').click();
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.locator('#stats-reset').click();
  expect((await storedProgress(page))?.cards[card.key]).toMatchObject({ attempts: 1 });
  await expect(page.locator('#stats-message')).toBeHidden();
});

test('back in Explore the board is free again and the repertoire move is marked', async ({ page }) => {
  await startDrill(page);
  const card = await currentCard(page);
  await page.locator('#mode-explore').click();
  await expect(page.locator('#mode-explore')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#drill')).toBeHidden();
  await expect(page.locator('#explore')).toBeVisible();
  await expect(page.locator('#board')).toHaveAttribute('data-interaction', 'side-to-move');

  // The position from the drill is still on the board, with the repertoire move starred.
  await expect(page.locator('#fen')).toHaveText(card.fen);
  const starred = page.locator('#explore tr', { has: page.locator('.explore-recommended') });
  await expect(starred.first()).toHaveAttribute('data-uci', card.move.uci);

  // Any legal move can be played again, and stepping back works.
  const wrong = wrongMove(card);
  await play(page, wrong.uci);
  await expect(page.locator('#moves .move').last()).toHaveText(wrong.san);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#fen')).toHaveText(card.fen);
});

test('Drill mode fits a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await startDrill(page);
  const card = await currentCard(page);
  await play(page, wrongMove(card).uci);
  await expect(feedback(page)).toHaveAttribute('data-kind', 'wrong');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#open-stats').click();
  const box = (await page.locator('#stats').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/phase5-narrow.png' });
});
