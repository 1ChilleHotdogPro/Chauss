import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site from https://<user>.github.io/Chauss/
  base: '/Chauss/',
  test: {
    // Unit tests only. Browser tests live in e2e/ and are run by Playwright.
    include: ['src/**/*.test.ts'],
  },
});
