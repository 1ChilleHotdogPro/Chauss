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

  // One tile per set, Close-up chosen by default.
  for (const id of ['closeup', 'wooden', 'room', 'soft', 'sfx', 'off']) {
    await expect(tile(id)).toHaveAttribute('role', 'radio');
  }
  await expect(tile('closeup')).toHaveAttribute('aria-checked', 'true');
  await expect(tile('room')).toHaveAttribute('aria-checked', 'false');

  // Club room: its files are fetched (the click is also the audio unlock), and the choice is saved.
  await tile('room').click();
  await expect(tile('room')).toHaveAttribute('aria-checked', 'true');
  await expect(tile('closeup')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => requested('sounds/room/Move.wav')).toBe(true);
  await expect.poll(() => requested('sounds/room/Capture.wav')).toBe(true);
  expect(await savedSounds()).toBe('room');
  // The other recorded sets are not fetched until they are picked.
  expect(requested('sounds/soft/')).toBe(false);

  // The choice survives a reload. (Let every download finish first, sounds, Stockfish and the Settings
  // piece pictures: a reload would cancel them, and a cancelled request counts as a failure.)
  await expect.poll(() => soundsPending).toBe(0);
  await expect(page.locator('#engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  const beforeReload = soundRequests.length;
  await page.reload();
  await expect(page.locator('cg-board piece')).toHaveCount(32);
  await page.locator('#open-settings').click();
  await expect(tile('room')).toHaveAttribute('aria-checked', 'true');
  await expect(tile('closeup')).toHaveAttribute('aria-checked', 'false');

  // After the reload only the saved set is fetched, and choosing Off fetches no other set. (The first
  // click unlocks audio, which loads the saved set and the cursed explosion.)
  await tile('off').click();
  await expect.poll(savedSounds).toBe('off');
  await expect.poll(() => soundsPending).toBe(0);
  expect(soundRequests.slice(beforeReload).filter((path) => /sounds\/(closeup|wooden|soft)\//.test(path))).toEqual([]);

  await page.locator('#settings-close').click();
});
