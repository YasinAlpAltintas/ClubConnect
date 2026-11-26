import { defineConfig, devices } from '@playwright/test'

// When PLAYWRIGHT_BASE_URL is set, the suite runs against an already deployed
// environment (NON-PROD regression or PROD sanity), so no local servers are started.
const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: remoteBaseUrl || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: remoteBaseUrl ? undefined : [
    {
      command: 'dotnet run --project ../backend/ClubConnect.Api --configuration Release --no-launch-profile --urls "http://127.0.0.1:5069"',
      url: 'http://127.0.0.1:5069/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
})
