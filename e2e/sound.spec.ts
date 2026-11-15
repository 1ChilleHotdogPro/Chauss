import { expect, openApp, playMoves, test } from './helpers';

test('every move makes a sound: a plain one, a capture one and a checkmate one', async ({ page }) => {
  // Count the audio contexts the page creates, and whether it makes any before the first click.
  await page.addInitScript(() => {
    const w = window as unknown as { __contexts: number; AudioContext: typeof AudioContext };
    w.__contexts = 0;
    const Original = w.AudioContext;
    w.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__contexts++;
      }
    };
  });
  await openApp(page);
  const contexts = () => page.evaluate(() => (window as unknown as { __contexts: number }).__contexts);
  const lastSound = () => page.evaluate(() => document.body.dataset.lastSound);

  // Browsers only allow audio after the user has acted: nothing is started before the first click.
  expect(await contexts()).toBe(0);
  expect(await lastSound()).toBeUndefined();

  await playMoves(page, ['e2e4']);
  expect(await contexts()).toBe(1);
  expect(await lastSound()).toBe('move');

  await playMoves(page, ['d7d5']);
  expect(await lastSound()).toBe('move');
  await playMoves(page, ['e4d5']);
  expect(await lastSound()).toBe('capture');

  // Going back makes no new sound.
  await page.evaluate(() => delete document.body.dataset.lastSound);
  await page.keyboard.press('ArrowLeft');
  expect(await lastSound()).toBeUndefined();

  // Fool's mate: the last move is checkmate.
  await page.locator('#reset').click();
  await playMoves(page, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  expect(await lastSound()).toBe('checkmate');
  expect(await contexts()).toBe(1);
});
