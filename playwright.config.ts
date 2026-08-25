import { defineConfig, devices } from '@playwright/test'

const PORT = 3210
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Every spec drives one browser tab against shared localStorage, so they run
  // serially per file but files can run in parallel.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // The app never legitimately needs a real microphone in tests; speech is
    // stubbed before page scripts run. Granting the permission stops Chromium
    // showing a prompt that would block the run.
    permissions: ['microphone'],
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Test the production build, not the dev server: dev-only warnings and
    // slower hydration make E2E flakier and less representative.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
