import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site from https://<user>.github.io/Chauss/
  base: '/Chauss/',
  test: {
    // Unit tests, plus tests/node/ which runs the real engine file under Node.
    // Browser tests live in e2e/ and are run by Playwright.
    include: ['src/**/*.test.ts', 'tests/node/**/*.test.mjs'],
    testTimeout: 60_000,
  },
});
