import { test, expect, mockCatalog, ready, audit, metadata } from './fixtures.js';

test.describe('User journeys with a deterministic catalog', () => {
  test.beforeEach(async ({ page }) => { await mockCatalog(page); });

  test('composes phrase search, category, platform, language, and collection filters', async ({ page }) => {
    await page.goto('./'); await ready(page);
    await page.getByRole('searchbox', { name: 'Search resources' }).fill('"SQL database"');
    await expect(page.getByRole('article')).toHaveCount(2);
    await page.getByRole('button', { name: /^Databases 2$/ }).click();
    await page.getByRole('combobox', { name: 'Platform topic' }).selectOption('Windows');
    await page.getByRole('combobox', { name: 'Language topic' }).selectOption('C / C++');
    await page.getByRole('combobox', { name: 'Collection', exact: true }).selectOption('windows');
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'SQLite', exact: true })).toBeVisible();
    await expect(page.locator('#result-count')).toHaveText('1 resource matching “"SQL database"”');
    await page.reload(); await ready(page);
    await expect(page.getByRole('combobox', { name: 'Collection', exact: true })).toHaveValue('windows');
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: /^Clear filters/ }).click();
    await expect(page.getByRole('article')).toHaveCount(24);
    await expect(page).toHaveURL(/\/dev-resource-explorer\/$/);
  });

  test('sorts results and moves keyboard focus to newly loaded resources', async ({ page }) => {
    await page.goto('./'); await ready(page);
    await expect(page.getByRole('article')).toHaveCount(24);
    await expect(page.getByRole('article').first().getByRole('heading')).toHaveText('SQLite');
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name');
    await expect(page.getByRole('article').first().getByRole('heading')).toHaveText('AndroidKit');
    await page.getByRole('button', { name: /Load more resources/ }).click();
    await expect(page.getByRole('article')).toHaveCount(31);
    await expect(page.getByRole('article').nth(24).getByRole('heading').getByRole('link')).toBeFocused();
    await expect(page.getByRole('button', { name: /Load more resources/ })).toBeHidden();
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('recent');
    await expect(page.getByRole('article')).toHaveCount(24);
    await expect(page.getByRole('article').first().getByRole('heading')).toHaveText('SQLite');
  });

  test('persists bookmarks, synchronizes open tabs, and recovers focus after the last removal', async ({ page, context }) => {
    await page.goto('./'); await ready(page);
    await page.getByRole('button', { name: 'Save SQLite', exact: true }).click();
    await page.reload(); await ready(page);
    await expect(page.getByRole('button', { name: 'Unsave SQLite', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /^Saved resources/ }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    const second = await context.newPage(); await mockCatalog(second);
    await second.goto('./?saved=1'); await ready(second);
    await page.getByRole('button', { name: 'Unsave SQLite', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your next favorite is out there.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset filters' })).toBeFocused();
    await expect(second.getByRole('article')).toHaveCount(0);
    await second.close();
  });

  test('keeps saved resources usable for the visit when storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked for test', 'SecurityError'); } });
    });
    await page.goto('./'); await ready(page);
    await expect(page.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Save SQLite', exact: true }).click();
    await page.getByRole('button', { name: /^Saved resources/ }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your next favorite is out there.' })).toBeVisible();
  });

  test('copies a usable search URL and keeps bookmarks out of it', async ({ page }) => {
    // Deterministic clipboard boundary: OS clipboard permissions differ by engine.
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { async writeText(text) { window.copiedSearch = text; } } }));
    await page.goto('./?q=SQLite&platform=Windows&sort=name'); await ready(page);
    await page.getByRole('button', { name: 'Share search: copy link to this search' }).click();
    const copied = await page.evaluate(() => window.copiedSearch);
    expect(new URL(copied).pathname).toBe('/dev-resource-explorer/');
    await page.goto(copied); await ready(page);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('searchbox', { name: 'Search resources' })).toHaveValue('SQLite');
    await page.getByRole('button', { name: 'Save SQLite', exact: true }).click();
    await page.getByRole('button', { name: /^Saved resources/ }).click();
    await page.getByRole('button', { name: 'Share search: copy link to this search' }).click();
    const privateCopy = new URL(await page.evaluate(() => window.copiedSearch));
    expect(privateCopy.search).toBe('');
    await expect(page.locator('#toast')).toHaveText('Search link copied. Bookmarks stay private to this browser.');
  });

  test('offers a copyable fallback when clipboard access fails', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { async writeText() { throw new Error('Unavailable'); } } }));
    await page.goto('./?q=SQLite'); await ready(page);
    const prompt = page.waitForEvent('dialog').then(async dialog => {
      expect(dialog.type()).toBe('prompt'); expect(dialog.defaultValue()).toMatch(/\/dev-resource-explorer\/\?q=SQLite$/);
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Share search: copy link to this search' }).click();
    await prompt;
  });

  test('announces empty results, supports filter removal, and resets browsing', async ({ page }, testInfo) => {
    await page.goto('./?q=no-such-resource');
    await expect(page.getByRole('heading', { name: 'No resources found' })).toBeVisible();
    await expect(page.locator('#result-count')).toHaveAttribute('role', 'status');
    await expect(page.locator('#result-count')).toContainText('0 resources');
    await audit(page, testInfo, 'empty');
    await page.getByRole('button', { name: 'Remove filter: Search: no-such-resource' }).click();
    await expect(page.getByRole('searchbox', { name: 'Search resources' })).toBeFocused();
    await expect(page.getByRole('article')).toHaveCount(24);
  });

  test('reaches resources through the keyboard skip link', async ({ page, browserName }) => {
    // Windows WebKit skips links with both Tab and Alt+Tab in the tested build.
    // Keep this explicit; Linux CI must exercise the real Tab behavior.
    // Related upstream keyboard preference: https://github.com/microsoft/playwright/issues/5609
    test.fixme(browserName === 'webkit' && process.platform === 'win32', 'Windows WebKit link-tabbing limitation; covered in Linux CI and other engines.');
    await page.goto('./'); await ready(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to resources' })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.locator('#results')).toBeFocused();
  });

  test('supports keyboard entry, named dialogs, focus containment, and focus return', async ({ page }, testInfo) => {
    await page.goto('./'); await ready(page);
    await page.keyboard.press('/'); await expect(page.getByRole('searchbox', { name: 'Search resources' })).toBeFocused();
    await page.keyboard.type('SQLite');
    await expect(page.getByRole('article')).toHaveCount(1);
    const opener = page.getByRole('button', { name: 'View notes for SQLite', exact: true });
    await opener.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'SQLite', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Original catalog notes (2)' })).toBeVisible();
    await expect(dialog.getByText('Research date: 2026-10-22', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /View the versioned source index/ })).toHaveAttribute('href', `https://github.com/SeanShaffer88/useful-dev-resources/blob/${metadata.source_commit}/resources.json`);
    const close = dialog.getByRole('button', { name: 'Close resource details' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: /View the versioned source index/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await audit(page, testInfo, 'resource-dialog');
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
    const about = page.getByRole('button', { name: 'About the catalog', exact: true });
    await about.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'A useful place to start.' })).toBeVisible();
    await audit(page, testInfo, 'about-dialog');
    await page.keyboard.press('Escape'); await expect(about).toBeFocused();
  });

  for (const failure of ['http', 'json', 'schema']) {
    test(`shows a useful catalog ${failure} failure without an uncaught exception`, async ({ page }, testInfo) => {
      await page.route('**/data/resources.json', route => failure === 'http'
        ? route.fulfill({ status: 503, body: 'Unavailable' })
        : failure === 'json' ? route.fulfill({ contentType: 'application/json', body: '{' })
          : route.fulfill({ json: [{ name: 'Missing required fields' }] }));
      await page.goto('./');
      await expect(page.getByRole('heading', { name: 'The catalog couldn’t load.' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Open the source catalog/ })).toHaveAttribute('href', 'https://github.com/SeanShaffer88/useful-dev-resources');
      await expect(page.locator('#result-count')).toHaveText('Catalog unavailable');
      await expect(page.locator('#resource-grid')).toHaveAttribute('aria-busy', 'false');
      await audit(page, testInfo, `load-${failure}`);
    });
  }

  for (const width of [320, 390, 768, 1440]) {
    test(`has accessible controls and no horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('./'); await ready(page);
      await expect(page.getByRole('searchbox', { name: 'Search resources' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save SQLite', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await audit(page, testInfo, `catalog-${width}`);
      if (width <= 850) {
        const toggle = page.getByRole('button', { name: /Browse categories/ });
        await expect(page.getByRole('complementary', { name: 'Resource categories' })).toBeHidden();
        await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.getByRole('searchbox', { name: 'Find a category' }).fill('Databases');
        await page.getByRole('button', { name: /^Databases 2$/ }).click();
        await expect(page.getByRole('article')).toHaveCount(2);
        await audit(page, testInfo, `expanded-filters-${width}`);
      }
      await page.getByRole('button', { name: 'View notes for SQLite', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'SQLite', exact: true });
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await audit(page, testInfo, `narrow-dialog-${width}`);
    });
  }
});

test('loads the real catalog, metadata, and modules under the GitHub Pages subpath', async ({ page, request }, testInfo) => {
  const response = await request.get('data/meta.json'); expect(response.ok()).toBe(true);
  const current = await response.json();
  await page.goto('./'); await ready(page);
  await expect(page.locator('#total-resources')).toHaveText(current.resource_count.toLocaleString('en-US'));
  await expect(page.locator('#snapshot-date')).toHaveText(current.imported_on);
  await expect(page.getByRole('article')).toHaveCount(Math.min(24, current.resource_count));
  await audit(page, testInfo, 'real-snapshot');
});
