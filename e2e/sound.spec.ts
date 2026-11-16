import type { Request } from '@playwright/test';
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

test('the sound set is chosen in Settings, saved, and only loads the files it needs', async ({ page }) => {
  // Every sound file the page asks for, as a path such as "/Chauss/sounds/nes/Move.mp3".
  const soundRequests: string[] = [];
  let soundsPending = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (!path.includes('/sounds/')) return;
    soundRequests.push(path);
    soundsPending++;
  });
  const settled = (request: Request) => {
    if (new URL(request.url()).pathname.includes('/sounds/')) soundsPending--;
  };
  page.on('requestfinished', settled);
  page.on('requestfailed', settled);
  const requested = (fragment: string) => soundRequests.some((path) => path.includes(fragment));
  const tile = (id: string) => page.locator(`#sound-sets button.style-tile[data-sounds="${id}"]`);
  const savedSounds = () =>
    page.evaluate(() => {
      const raw = localStorage.getItem('chauss.appearance.v1');
      return raw ? (JSON.parse(raw) as { sounds?: string }).sounds : undefined;
    });

  await openApp(page);
  await page.locator('#open-settings').click();

  // One tile per set, piano chosen by default.
  for (const id of ['piano', 'wood', 'nes', 'futuristic', 'sfx', 'off']) {
    await expect(tile(id)).toHaveAttribute('role', 'radio');
  }
  await expect(tile('piano')).toHaveAttribute('aria-checked', 'true');
  await expect(tile('nes')).toHaveAttribute('aria-checked', 'false');

  // Retro: its files are fetched (the click is also the audio unlock), and the choice is saved.
  await tile('nes').click();
  await expect(tile('nes')).toHaveAttribute('aria-checked', 'true');
  await expect(tile('piano')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => requested('sounds/nes/Move.mp3')).toBe(true);
  await expect.poll(() => requested('sounds/nes/Capture.mp3')).toBe(true);
  expect(await savedSounds()).toBe('nes');

  // The choice survives a reload. (Let the downloads finish first: a reload would cancel them, and a
  // cancelled request counts as a failure.)
  await expect.poll(() => soundsPending).toBe(0);
  await page.reload();
  await expect(page.locator('cg-board piece')).toHaveCount(32);
  await page.locator('#open-settings').click();
  await expect(tile('nes')).toHaveAttribute('aria-checked', 'true');
  await expect(tile('piano')).toHaveAttribute('aria-checked', 'false');

  // Wood is made in code: choosing it fetches nothing.
  await tile('wood').click();
  await expect(tile('wood')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(savedSounds).toBe('wood');
  // Give a stray fetch time to show up before checking that none was made.
  await page.waitForTimeout(500);
  expect(soundRequests.filter((path) => path.includes('sounds/wood/'))).toEqual([]);

  await page.locator('#settings-close').click();
});
