const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  outputDir: '/tmp/playwright-test-results',
  fullyParallel: true,
  reporter: 'list',
  timeout: 30_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 0.0.0.0 --directory jekyll/_site',
    url: 'http://127.0.0.1:4173/about/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
