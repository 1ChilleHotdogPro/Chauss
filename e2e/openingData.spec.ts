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

  test('having chosen it does not break the page: the default opening is used, and it cannot be chosen', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#snapshot-info')).toHaveAttribute('data-state', 'ready');
    await page.locator('#mode-drill').click();
    await page.locator('#drill-hub [data-category="openings"]').click();
    await expect(page.locator(`#drill-hub [data-entry="${unbuilt!.id}"]`)).toBeDisabled();
    await enterDrill(page, 'ponziani');
  });
});
