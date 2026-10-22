import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const entry = (name, url, category, purpose, extra = {}) => ({
  name, url, category, purpose, source: 'general', checked_on: '2026-10-01',
  review: 'Browser regression fixture; not a resource recommendation.', http_status: '', ...extra,
});
export const catalog = [
  entry('SQLite', 'https://sqlite.org/', 'Databases', 'Embedded SQL database; Windows C library.', { checked_on: '2026-10-22' }),
  entry('SQLite Windows notes', 'https://sqlite.org/', 'Windows / Databases', 'Additional Windows integration evidence.', { source: 'windows', checked_on: '2026-10-21' }),
  entry('BetaSQL', 'https://example.org/beta', 'Databases', 'SQL database for Linux and Python.'),
  entry('AtlasSearch', 'https://example.org/atlas', 'Search', 'JavaScript browser full text search.'),
  entry('AndroidKit', 'https://example.org/android', 'Mobile', 'Android Java Kotlin development tools.', { source: 'android' }),
  ...Array.from({ length: 27 }, (_, i) => entry(`Tool ${String(i + 1).padStart(2, '0')}`, `https://example.org/tool-${i + 1}`, 'Utilities', 'General utilities for developer workflows.')),
];
export const metadata = {
  source_commit: 'a'.repeat(40), imported_on: '2026-10-22', entry_count: 32,
  resource_count: 31, category_count: 5,
};

// Keep UI tests stable as the independently maintained catalog grows.
// A separate smoke test loads the real snapshot without these routes.
export async function mockCatalog(page) {
  await page.route('**/data/resources.json', route => route.fulfill({ json: catalog }));
  await page.route('**/data/meta.json', route => route.fulfill({ json: metadata }));
}
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // App browsing is entirely local; never exercise upstream resource websites.
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.abort());
    await use(page);
    expect(errors, 'Uncaught browser errors').toEqual([]);
  },
});
export { expect };
export async function ready(page) {
  await expect(page.locator('#resource-grid')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('article').first()).toBeVisible();
}
export async function audit(page, testInfo, state) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  // Retain the review-required results too: an incomplete check is not a pass.
  await testInfo.attach(`axe-${state}`, { body: JSON.stringify({ violations: result.violations, incomplete: result.incomplete }, null, 2), contentType: 'application/json' });
  const summary = result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
  expect(summary, `Accessibility violations in ${state}`).toEqual([]);
}
