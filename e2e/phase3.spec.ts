import type { Page, Request } from '@playwright/test';
import { expect, openApp, playMoves, test } from './helpers';

// Not a real token: these tests never talk to Lichess. Every explorer request is answered here.
const FAKE_TOKEN = 'lip_testTokenNotReal123';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const ANSWER = {
  white: 1_000_000,
  draws: 100_000,
  black: 900_000,
  moves: [
    { uci: 'e2e4', san: 'e4', averageRating: 1200, white: 600_000, draws: 50_000, black: 500_000, game: null, opening: null },
    { uci: 'd2d4', san: 'd4', averageRating: 1210, white: 300_000, draws: 30_000, black: 250_000, game: null, opening: null },
  ],
  topGames: [],
  recentGames: [],
  opening: null,
};

/** Answer every explorer request with `status`, and record what the page sent. */
async function mockExplorer(page: Page, status = 200): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route('https://explorer.lichess.org/**', async (route) => {
    requests.push(route.request());
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: status === 200 ? JSON.stringify(ANSWER) : '',
    });
  });
  return requests;
}

async function openSettings(page: Page): Promise<void> {
  await page.locator('#open-settings').click();
  await expect(page.locator('#settings')).toBeVisible();
}

const storedSettings = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('chauss.settings.v1') ?? 'null') as Record<string, unknown> | null);

test('Settings opens with sensible defaults and closes again', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#settings')).toBeHidden();
  await openSettings(page);

  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#token')).toHaveAttribute('type', 'password');
  await expect(page.locator('#token-state')).toHaveText(/No token saved/);
  await expect(page.locator('#token-clear')).toBeDisabled();

  const checked = (name: string) =>
    page.locator(`#settings input[name="${name}"]:checked`).evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  expect(await checked('rating')).toEqual(['1000', '1200']);
  expect(await checked('speed')).toEqual(['blitz', 'rapid', 'classical']);
  await expect(page.locator('#rating-summary')).toHaveText('Counting games rated 1000-1399.');
  await expect(page.locator('#settings input[name="rating"]')).toHaveCount(9);

  await page.locator('#settings-close').click();
  await expect(page.locator('#settings')).toBeHidden();

  await openSettings(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings')).toBeHidden();
});

test('the token is stored in this browser, survives a reload, and can be cleared', async ({ page }) => {
  const requests = await mockExplorer(page);
  await openApp(page);
  await openSettings(page);

  await page.locator('#token').fill(FAKE_TOKEN);
  await expect(page.locator('#token-state')).toHaveText('A token is saved in this browser.');
  expect((await storedSettings(page))?.token).toBe(FAKE_TOKEN);

  // Show / hide what was typed.
  await page.locator('#token-show').click();
  await expect(page.locator('#token')).toHaveAttribute('type', 'text');
  await page.locator('#token-show').click();
  await expect(page.locator('#token')).toHaveAttribute('type', 'password');

  // Let the engine finish loading first: reloading mid-download would cancel that request,
  // which the "no failed requests" guard rightly reports.
  await expect(page.locator('#engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.reload();
  await expect(page.locator('cg-board piece')).toHaveCount(32);
  await openSettings(page);
  await expect(page.locator('#token')).toHaveValue(FAKE_TOKEN);

  await page.locator('#token-clear').click();
  await expect(page.locator('#token')).toHaveValue('');
  await expect(page.locator('#token-state')).toHaveText(/No token saved/);
  expect((await storedSettings(page))?.token).toBe('');

  // Saving or clearing a token never contacts Lichess by itself.
  expect(requests).toHaveLength(0);
  // And the token never ends up in the page address.
  expect(page.url()).not.toContain(FAKE_TOKEN);
});

test('Test connection: success shows the games and sends the token in the header', async ({ page }) => {
  const requests = await mockExplorer(page);
  await openApp(page);
  await openSettings(page);
  await page.locator('#token').fill(FAKE_TOKEN);

  await page.locator('#explorer-test').click();
  const result = page.locator('#explorer-test-result');
  await expect(result).toHaveAttribute('data-status', 'ok');
  await expect(result).toHaveText('Connected. 2,000,000 games in this position; most played move: e4.');

  const gets = requests.filter((request) => request.method() === 'GET');
  expect(gets).toHaveLength(1);
  const request = gets[0]!;
  expect(request.headers().authorization).toBe(`Bearer ${FAKE_TOKEN}`);
  expect(request.url()).not.toContain(FAKE_TOKEN);

  const url = new URL(request.url());
  expect(url.pathname).toBe('/lichess');
  expect(url.searchParams.get('fen')).toBe(START);
  expect(url.searchParams.get('ratings')).toBe('1000,1200');
  expect(url.searchParams.get('speeds')).toBe('blitz,classical,rapid');
  expect(url.searchParams.get('variant')).toBe('standard');
});

test('Test connection asks about the position on the board, with the chosen groups', async ({ page }) => {
  const requests = await mockExplorer(page);
  await openApp(page);
  await playMoves(page, ['e2e4', 'e7e5']);
  await openSettings(page);
  await page.locator('#token').fill(FAKE_TOKEN);

  // Switch to 1400-1599 rapid only.
  await page.locator('#settings input[name="rating"][value="1400"]').check();
  await page.locator('#settings input[name="rating"][value="1000"]').uncheck();
  await page.locator('#settings input[name="rating"][value="1200"]').uncheck();
  await page.locator('#settings input[name="speed"][value="blitz"]').uncheck();
  await page.locator('#settings input[name="speed"][value="classical"]').uncheck();
  await expect(page.locator('#rating-summary')).toHaveText('Counting games rated 1400-1599.');

  // The last ticked box cannot be unticked: there must always be one group.
  await page.locator('#settings input[name="rating"][value="1400"]').click();
  await expect(page.locator('#settings input[name="rating"][value="1400"]')).toBeChecked();
  await page.locator('#settings input[name="speed"][value="rapid"]').click();
  await expect(page.locator('#settings input[name="speed"][value="rapid"]')).toBeChecked();

  expect(await storedSettings(page)).toMatchObject({ ratings: [1400], speeds: ['rapid'] });

  await page.locator('#explorer-test').click();
  await expect(page.locator('#explorer-test-result')).toHaveAttribute('data-status', 'ok');

  // (The Explore panel may fetch live data for the new groups too; the connection test is the
  // last Lichess request made.)
  const lichessRequests = requests.filter(
    (request) => request.method() === 'GET' && new URL(request.url()).pathname === '/lichess',
  );
  const url = new URL(lichessRequests.at(-1)!.url());
  expect(url.searchParams.get('ratings')).toBe('1400');
  expect(url.searchParams.get('speeds')).toBe('rapid');
  expect(url.searchParams.get('fen')).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
});

test('Test connection without a token sends nothing and says why', async ({ page }) => {
  const requests = await mockExplorer(page);
  await openApp(page);
  await openSettings(page);
  await page.locator('#explorer-test').click();

  const result = page.locator('#explorer-test-result');
  await expect(result).toHaveAttribute('data-status', 'error');
  await expect(result).toHaveText('No token set. Paste your Lichess token above first.');
  expect(requests).toHaveLength(0);
});

test.describe('when Lichess refuses', () => {
  // These tests make Lichess answer with an error on purpose; the browser logs that.
  test.use({ allowedProblems: /explorer\.lichess\.org|Failed to load resource.*(401|429)/ });

  test('a rejected token (401) is explained', async ({ page }) => {
    await mockExplorer(page, 401);
    await openApp(page);
    await openSettings(page);
    await page.locator('#token').fill(FAKE_TOKEN);
    await page.locator('#explorer-test').click();

    const result = page.locator('#explorer-test-result');
    await expect(result).toHaveAttribute('data-status', 'error');
    await expect(result).toHaveText(/Lichess rejected the token \(error 401\)/);
  });

  test('too many requests (429): explained, and nothing more is sent for a minute', async ({ page }) => {
    const requests = await mockExplorer(page, 429);
    await openApp(page);
    await openSettings(page);
    await page.locator('#token').fill(FAKE_TOKEN);

    const result = page.locator('#explorer-test-result');
    await page.locator('#explorer-test').click();
    await expect(result).toHaveText(/too many requests \(error 429\)\. Wait about (60|59) seconds/);
    const sentAfterFirst = requests.filter((request) => request.method() === 'GET').length;
    expect(sentAfterFirst).toBe(1);

    // Clicking again does not hammer Lichess: the app itself refuses until the minute is over.
    await page.locator('#explorer-test').click();
    await expect(result).toHaveText(/too many requests \(error 429\)/);
    await expect(page.locator('#explorer-test')).toBeEnabled();
    expect(requests.filter((request) => request.method() === 'GET')).toHaveLength(1);
  });
});

test('board hotkeys are switched off while Settings is open', async ({ page }) => {
  await openApp(page);
  await openSettings(page);

  // Typing letters that are hotkeys (f, e, a) into the token box must not flip the board etc.
  await page.locator('#token').fill('');
  await page.locator('#token').pressSequentially('fea');
  await expect(page.locator('#token')).toHaveValue('fea');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
  await expect(page.locator('#evalbar')).toBeHidden();

  // Also with the focus on a button inside the dialog.
  await page.locator('#explorer-test').focus();
  await page.keyboard.press('f');
  await page.keyboard.press('e');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-white/);
  await expect(page.locator('#evalbar')).toBeHidden();

  // Back on the board they work again.
  await page.locator('#token-clear').click();
  await page.locator('#settings-close').click();
  await page.keyboard.press('f');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
});

test('Settings fits a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openApp(page);
  await openSettings(page);
  const box = (await page.locator('#settings').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#settings-close')).toBeVisible();
  await page.screenshot({ path: 'test-results/phase3-settings-narrow.png' });
});
