import {
  clickSquare,
  dragMove,
  drawnPieces,
  expect,
  moveTexts,
  openApp,
  playMoves,
  test,
  tryMove,
} from './helpers';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PONZIANI = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3';

test('loads with the start position and no errors', async ({ page }) => {
  await openApp(page);
  await expect(page).toHaveTitle(/Chauss/);
  await expect(page.locator('#fen')).toHaveText(START);
  await expect(page.locator('#status')).toHaveText('White to move');
  await expect(page.locator('#moves .move')).toHaveCount(0);
  await expect(page.locator('#undo')).toBeDisabled();

  const pieces = await drawnPieces(page);
  expect(Object.keys(pieces)).toHaveLength(32);
  expect(pieces.e1).toBe('white king');
  expect(pieces.d8).toBe('black queen');

  // The board is a visible square of a sensible size.
  const box = await page.locator('cg-board').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(300);
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
});

test('plays the Ponziani by clicking squares', async ({ page }) => {
  await openApp(page);
  await playMoves(page, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3']);

  expect(await moveTexts(page)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'c3']);
  await expect(page.locator('#fen')).toHaveText(PONZIANI);
  await expect(page.locator('#status')).toHaveText('Black to move');
  await expect(page.locator('#moves li')).toHaveCount(3);
  await expect(page.locator('#moves .move.current')).toHaveText('c3');

  const pieces = await drawnPieces(page);
  expect(pieces.c3).toBe('white pawn');
  expect(pieces.f3).toBe('white knight');
  expect(pieces.c6).toBe('black knight');
  expect(pieces.c2).toBeUndefined();

  await page.screenshot({ path: 'test-results/ponziani.png', fullPage: true });
});

test('shows the legal target squares of a selected piece', async ({ page }) => {
  await openApp(page);
  await clickSquare(page, 'g1');
  // The knight on g1 can go to f3 or h3: exactly two highlighted squares.
  await expect(page.locator('cg-board square.move-dest')).toHaveCount(2);
});

test('rejects illegal moves', async ({ page }) => {
  await openApp(page);

  await tryMove(page, 'e2', 'e5'); // a pawn cannot jump three squares
  await tryMove(page, 'g1', 'g3'); // not a knight move
  await tryMove(page, 'e7', 'e5'); // Black piece on White's turn
  await tryMove(page, 'a1', 'a4'); // rook is blocked by its own pawn

  await expect(page.locator('#moves .move')).toHaveCount(0);
  await expect(page.locator('#fen')).toHaveText(START);

  // An illegal drag snaps back as well.
  await dragMove(page, 'e2', 'e5');
  await expect(page.locator('#fen')).toHaveText(START);
  await expect.poll(async () => (await drawnPieces(page)).e2).toBe('white pawn');
  expect((await drawnPieces(page)).e5).toBeUndefined();
});

test('moves by dragging a piece', async ({ page }) => {
  await openApp(page);
  await dragMove(page, 'e2', 'e4');
  await expect(page.locator('#moves .move')).toHaveText(['e4']);
  await dragMove(page, 'e7', 'e5');
  await expect(page.locator('#moves .move')).toHaveText(['e4', 'e5']);
  await expect(page.locator('#fen')).toHaveText(
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  );
});

test('flips the board with the button and the F key', async ({ page }) => {
  await openApp(page);
  const wrap = page.locator('.cg-wrap');
  await expect(wrap).toHaveClass(/orientation-white/);

  // White's pawns start near the bottom of the screen.
  const board = (await page.locator('cg-board').boundingBox())!;
  const e2Before = (await page.locator('cg-board piece.white.pawn').first().boundingBox())!;
  expect(e2Before.y).toBeGreaterThan(board.y + board.height / 2);

  await page.locator('#flip').click();
  await expect(wrap).toHaveClass(/orientation-black/);
  const e2After = (await page.locator('cg-board piece.white.pawn').first().boundingBox())!;
  expect(e2After.y).toBeLessThan(board.y + board.height / 2);

  // Moves still land on the right squares with Black at the bottom.
  await playMoves(page, ['e2e4', 'e7e5', 'g1f3']);
  expect(await moveTexts(page)).toEqual(['e4', 'e5', 'Nf3']);
  expect((await drawnPieces(page)).f3).toBe('white knight');
  await page.screenshot({ path: 'test-results/flipped.png', fullPage: true });

  await page.keyboard.press('f');
  await expect(wrap).toHaveClass(/orientation-white/);
  // Flipping does not change the game.
  expect(await moveTexts(page)).toEqual(['e4', 'e5', 'Nf3']);
});

test('undo, arrow keys and clicking a move step through the game', async ({ page }) => {
  await openApp(page);
  await playMoves(page, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3']);

  await page.locator('#undo').click();
  expect(await moveTexts(page)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  await expect.poll(async () => (await drawnPieces(page)).c2).toBe('white pawn');

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#moves .move.current')).toHaveText('Nf3');
  await expect(page.locator('#status')).toHaveText('Black to move');
  await expect.poll(async () => (await drawnPieces(page)).b8).toBe('black knight');
  expect(await moveTexts(page)).toHaveLength(4); // later moves are kept

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#moves .move.current')).toHaveText('Nc6');
  await expect(page.locator('#next')).toBeDisabled();

  await page.locator('#moves .move', { hasText: /^e4$/ }).click();
  await expect(page.locator('#fen')).toHaveText(
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  );

  // A different move from here replaces the rest of the line.
  await tryMove(page, 'c7', 'c5');
  await expect(page.locator('#moves .move')).toHaveText(['e4', 'c5']);

  await page.locator('#prev').click();
  await page.locator('#prev').click();
  await expect(page.locator('#fen')).toHaveText(START);
  await expect(page.locator('#prev')).toBeDisabled();

  await page.locator('#reset').click();
  await expect(page.locator('#moves .move')).toHaveCount(0);
  await expect(page.locator('#moves-empty')).toBeVisible();
});

test('castling moves the rook and en passant removes the pawn', async ({ page }) => {
  await openApp(page);
  await playMoves(page, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1']);
  expect((await moveTexts(page)).at(-1)).toBe('O-O');
  await expect
    .poll(async () => {
      const p = await drawnPieces(page);
      return [p.g1, p.f1, p.h1, p.e1];
    })
    .toEqual(['white king', 'white rook', undefined, undefined]);

  await page.locator('#reset').click();
  await playMoves(page, ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
  expect((await moveTexts(page)).at(-1)).toBe('exd6');
  await expect
    .poll(async () => {
      const p = await drawnPieces(page);
      return [p.d6, p.d5, p.e5];
    })
    .toEqual(['white pawn', undefined, undefined]);
});

test('promotion asks for a piece, and can be cancelled', async ({ page }) => {
  await openApp(page);
  await playMoves(page, ['h2h4', 'g7g5', 'h4g5', 'g8f6', 'g5g6', 'b8a6', 'g6g7', 'a6b8']);

  const picker = page.locator('#promotion');
  await expect(picker).toBeHidden();

  // Cancel with Escape: no move is made and the pawn goes back.
  await tryMove(page, 'g7', 'h8');
  await expect(picker).toBeVisible();
  await expect(picker.locator('button')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(page.locator('#moves .move')).toHaveCount(8);
  await expect
    .poll(async () => {
      const p = await drawnPieces(page);
      return [p.g7, p.h8];
    })
    .toEqual(['white pawn', 'black rook']);

  // Choose a knight.
  await tryMove(page, 'g7', 'h8');
  await picker.locator('button[data-piece="n"]').click();
  await expect(picker).toBeHidden();
  expect((await moveTexts(page)).at(-1)).toBe('gxh8=N');
  await expect(page.locator('#fen')).toHaveText(/^rnbqkb1N\//);
  await expect.poll(async () => (await drawnPieces(page)).h8).toBe('white knight');
});

test("shows check and checkmate (Fool's mate)", async ({ page }) => {
  await openApp(page);
  await playMoves(page, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  expect((await moveTexts(page)).at(-1)).toBe('Qh4#');
  await expect(page.locator('#status')).toHaveText('Checkmate — Black wins');
  await expect(page.locator('cg-board square.check')).toHaveCount(1);

  // No further moves are possible.
  await tryMove(page, 'e2', 'e4');
  await expect(page.locator('#moves .move')).toHaveCount(4);
});

test('works on a narrow (phone-sized) screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openApp(page);
  const box = (await page.locator('cg-board').boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(390);
  expect(box.width).toBeGreaterThan(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await playMoves(page, ['e2e4', 'e7e5']);
  expect(await moveTexts(page)).toEqual(['e4', 'e5']);
  await page.screenshot({ path: 'test-results/narrow.png', fullPage: true });
});
