import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4183/dev-resource-explorer/',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({
    name: browserName, use: { browserName },
  })),
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: '4183', BASE_PATH: '/dev-resource-explorer/' },
    url: 'http://127.0.0.1:4183/dev-resource-explorer/',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
