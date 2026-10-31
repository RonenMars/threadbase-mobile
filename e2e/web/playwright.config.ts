import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: '.',
  outputDir: '../_artifacts/web/results',
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { outputFolder: '../_artifacts/web/report', open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { slowMo: Number(process.env.PW_SLOWMO) || 0 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-server.js',
      cwd: '../..',
      url: 'http://127.0.0.1:7071/api/info',
      reuseExistingServer: !isCI,
    },
    {
      command: 'npx expo serve dist --port 4173',
      cwd: '../..',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !isCI,
    },
  ],
})
