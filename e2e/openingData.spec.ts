import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OPENINGS } from '../src/openings/registry';
import { enterDrill, expect, openApp, test } from './helpers';

// An opening the registry lists before its data file has been built (none, once every crawl is done).
const unbuilt = OPENINGS.find(
  (opening) => !existsSync(fileURLToPath(new URL(`../src/data/openings/${opening.id}.json`, import.meta.url))),
);

test.describe('an opening whose data is not built yet', () => {
  test.skip(!unbuilt, 'every opening in the registry has its data');
  test.use({ openingSeed: unbuilt?.id ?? null });

  test('having chosen it does not break the page: the picker asks again, and it cannot be chosen', async ({ page }) => {
    await page.goto('./');
    const picker = page.locator('#opening-picker');
    await expect(picker).toBeVisible();
    const card = picker.locator(`.opening-choice[data-opening="${unbuilt!.id}"]`);
    await expect(card).toBeDisabled();
    await expect(card).toContainText('Coming soon');

    // Another opening works, and so do the buttons. (Choosing reloads the page: let Stockfish finish
    // loading first, so the reload does not cut its download short.)
    await expect(page.locator('#engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await picker.locator('.opening-choice[data-opening="ponziani"]').click();
    await expect(page.locator('cg-board piece')).toHaveCount(32);
    await enterDrill(page);
    await expect(page.locator('#mode-drill')).toHaveAttribute('aria-selected', 'true');
  });

  test('the header picker lists it as coming soon', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chauss.opening.v1', 'ponziani'));
    await openApp(page);
    await page.locator('#open-picker').click();
    await expect(page.locator(`.opening-choice[data-opening="${unbuilt!.id}"]`)).toBeDisabled();
  });
});
