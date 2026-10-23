// The Playwright test object used by every spec: adds a "source" annotation
// linking each test to its code on GitHub.
import { test as base } from '@playwright/test';
import { sourceUrl } from './env';

export const test = base.extend<{ sourceLink: void }>({
  sourceLink: [async ({}, use, testInfo) => {
    testInfo.annotations.push({ type: 'source', description: sourceUrl(testInfo.file, testInfo.line) });
    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';
