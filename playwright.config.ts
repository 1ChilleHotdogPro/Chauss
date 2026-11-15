import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets several checkouts (git worktrees) run the e2e suite at the same time.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const URL = `http://localhost:${PORT}/Chauss/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Test the real production build, served under the same /Chauss/ path as GitHub Pages.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
