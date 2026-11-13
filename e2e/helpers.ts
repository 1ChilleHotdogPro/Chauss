import { test as base, expect, type Page } from '@playwright/test';

export { expect };
/** The plain Playwright test, without the "no errors" guard — for tests that cause an error on purpose. */
export { base as unguardedTest };

/**
 * Every test using this `test` fails if the page logged a console error or
 * warning, threw an exception, or a request failed.
 */
export const test = base.extend<{ problems: string[]; allowedProblems: RegExp | null }>({
  /** Problems a test causes on purpose (e.g. a mocked HTTP 401). Set with `test.use(...)`. */
  allowedProblems: [null, { option: true }],
  problems: [
    async ({ page, allowedProblems }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          problems.push(`console ${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
      page.on('response', (response) => {
        if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await use(problems);
      const unexpected = problems.filter((problem) => !allowedProblems?.test(problem));
      expect(unexpected, 'the page should produce no errors').toEqual([]);
    },
    { auto: true },
  ],
});

export async function openApp(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('cg-board piece')).toHaveCount(32);
}

/** Screen position of the middle of a square such as "e4", whichever way the board is turned. */
export async function squareCenter(page: Page, square: string): Promise<{ x: number; y: number }> {
  const box = await page.locator('cg-board').boundingBox();
  if (!box) throw new Error('board not visible');
  const blackAtBottom = await page
    .locator('.cg-wrap')
    .evaluate((el) => el.classList.contains('orientation-black'));
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const column = blackAtBottom ? 7 - file : file;
  const row = blackAtBottom ? rank : 7 - rank;
  return {
    x: box.x + ((column + 0.5) * box.width) / 8,
    y: box.y + ((row + 0.5) * box.height) / 8,
  };
}

export async function clickSquare(page: Page, square: string): Promise<void> {
  const point = await squareCenter(page, square);
  await page.mouse.click(point.x, point.y);
}

/** Try a move by clicking the piece, then the target square. Does not check the result. */
export async function tryMove(page: Page, from: string, to: string): Promise<void> {
  await clickSquare(page, from);
  await clickSquare(page, to);
}

/** Play moves written as "e2e4" by clicking, waiting for each to show up in the move list. */
export async function playMoves(page: Page, moves: string[]): Promise<void> {
  const list = page.locator('#moves .move');
  let count = await list.count();
  for (const move of moves) {
    await tryMove(page, move.slice(0, 2), move.slice(2, 4));
    count += 1;
    await expect(list, `move ${move} should be accepted`).toHaveCount(count);
  }
}

/** Move a piece by dragging it with the mouse. */
export async function dragMove(page: Page, from: string, to: string): Promise<void> {
  const start = await squareCenter(page, from);
  const end = await squareCenter(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
}

/** The moves shown in the move list, e.g. ["e4", "e5", "Nf3"]. */
export async function moveTexts(page: Page): Promise<string[]> {
  return page.locator('#moves .move').allTextContents();
}

/**
 * What chessground is actually drawing: square -> "white pawn" etc.
 * Read from the board's own DOM, so it checks the picture, not just our FEN text.
 */
export async function drawnPieces(page: Page): Promise<Record<string, string>> {
  return page.locator('cg-board').evaluate((boardEl) => {
    const result: Record<string, string> = {};
    for (const piece of boardEl.querySelectorAll('piece')) {
      if (piece.classList.contains('ghost') || piece.classList.contains('fading')) continue;
      const key = (piece as unknown as { cgKey?: string }).cgKey;
      const color = piece.classList.contains('white') ? 'white' : 'black';
      const role = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].find((r) =>
        piece.classList.contains(r),
      );
      if (key && role) result[key] = `${color} ${role}`;
    }
    return result;
  });
}
