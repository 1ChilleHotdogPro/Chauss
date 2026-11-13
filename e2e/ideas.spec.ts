import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { IDEAS } from '../src/explore/ideaList';
import { buildRepertoire } from '../src/repertoire/repertoire';
import { positionKey, type Snapshot } from '../src/snapshot/format';
import { expect, openApp, playMoves, test, tryMove } from './helpers';

const snapshot = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/ponziani.json', import.meta.url)), 'utf8'),
) as Snapshot;
const repertoire = buildRepertoire(snapshot);

/** Moves written as "e2e4" for a line in normal notation. */
function toUci(line: readonly string[]): string[] {
  const chess = new Chess();
  return line.map((san) => {
    const move = chess.move(san);
    return move.from + move.to;
  });
}

test('Explore shows the written idea at its position, and none elsewhere', async ({ page }) => {
  await openApp(page);
  const idea = IDEAS.find((candidate) => candidate.line.length === 5)!; // the one right after 3.c3
  await playMoves(page, toUci(idea.line));
  await expect(page.locator('#explore-idea')).toHaveText(idea.text);
  await page.screenshot({ path: 'test-results/ideas-explore.png', fullPage: true });

  // One move further on (a position without an idea), the remark is gone.
  const chess = new Chess();
  for (const san of idea.line) chess.move(san);
  const withIdea = new Set(IDEAS.map((candidate) => candidate.line.join(' ')));
  const quiet = chess.moves().find((san) => !withIdea.has([...idea.line, san].join(' ')))!;
  const move = chess.move(quiet);
  await tryMove(page, move.from, move.to);
  await expect(page.locator('#moves .move')).toHaveCount(idea.line.length + 1);
  await expect(page.locator('#explore-idea')).toHaveCount(0);
});

test("Stop at the end of a drill line shows the line's key idea", async ({ page }) => {
  await openApp(page);
  await page.locator('#mode-drill').click();
  const prompt = page.locator('#drill-prompt');
  for (let guard = 0; guard < 30; guard++) {
    await expect
      .poll(async () => {
        const state = await prompt.getAttribute('data-state');
        const interaction = await page.locator('#board').getAttribute('data-interaction');
        return state === 'finished' || (state === 'asking' && interaction === 'white-only');
      })
      .toBe(true);
    if ((await prompt.getAttribute('data-state')) !== 'asking') break;
    const before = (await page.locator('#fen').textContent())!;
    const card = repertoire.cards.get(positionKey(before))!;
    await tryMove(page, card.move.uci.slice(0, 2), card.move.uci.slice(2, 4));
    // The board reports the move a moment after the click: wait for it before looking again.
    await expect(page.locator('#fen')).not.toHaveText(before);
  }
  await page.locator('#oob-stop').click();
  const idea = page.locator('#oob-result [data-part="idea"]');
  await expect(idea).toBeVisible();
  // It names the earlier position it belongs to, e.g. "Key idea (after 3...Nf6): ...".
  const shown = (await idea.textContent())!;
  expect(shown).toMatch(/^Key idea( \(after \d+\.(\.\.)?\S+\))?: /);
  const text = shown.replace(/^Key idea( \([^)]*\))?: /, '');
  expect(IDEAS.map((candidate) => candidate.text)).toContain(text);
  await expect(page.locator('#oob-result [data-part="balance"]')).toContainText('Stockfish (depth', { timeout: 20_000 });
  await page.screenshot({ path: 'test-results/ideas-stop.png', fullPage: true });
});
