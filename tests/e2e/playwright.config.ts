import { defineConfig } from '@playwright/test';

// No browser is involved: specs drive the jConvertIIO CLI and the ImageProbe
// oracle and attach their logs and image previews to the HTML report.
export default defineConfig({
  testDir: './features',
  globalSetup: './global-setup.ts',
  outputDir: 'test-results',
  timeout: 5 * 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.UPDATE_GOLDENS === '1' ? 1 : process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'report/playwright', title: 'VICARIO feature tests' }],
    // landing page report/index.html (feature overview) and report/overview.md
    ['./support/overview-reporter.ts', { outputFolder: 'report' }],
    ['junit', { outputFile: 'results/junit.xml' }],
    ['json', { outputFile: 'results/results.json' }],
  ],
  projects: [
    // PR gate: synthetic data, GDAL fixtures and small public products
    { name: 'fast', grep: /@fast/ },
    // nightly / release: adds full-size public products
    { name: 'full', grep: /@fast|@full/ },
  ],
});
