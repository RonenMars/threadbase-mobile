import { test, expect, type Page } from '@playwright/test'

const ORIGIN = 'http://127.0.0.1:4173'
const SERVER_URL = 'http://127.0.0.1:7071'

const SEEDED = {
  cookies: [],
  origins: [
    {
      origin: ORIGIN,
      localStorage: [
        {
          name: 'threadbase_servers',
          value: JSON.stringify({
            list: [{ id: 'srv_smoke', url: SERVER_URL, label: 'Mock' }],
            displayedServerIds: ['srv_smoke'],
            hasEverHadServer: true,
          }),
        },
        { name: 'threadbase_api_key_srv_smoke', value: 'mock-key-123' },
      ],
    },
  ],
}

let pageErrors: Error[] = []

test.beforeEach(({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error))
})

test.afterEach(() => {
  expect(pageErrors, 'uncaught page errors').toEqual([])
})

async function startManualPairing(page: Page, token: string) {
  await page.goto('/')
  await page.getByTestId('onboarding-language-cta').click()
  await page.getByTestId('onboarding-welcome-cta').click()
  await page.getByTestId('onboarding-connect-paste-card').click()
  await page.getByTestId('onboarding-connect-url-input').fill('127.0.0.1:7071')
  await page.getByTestId('onboarding-connect-token-input').fill(token)
  await page.getByTestId('onboarding-connect-handshake-cta').click()
}

test('fresh boot reaches onboarding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('onboarding-language-cta')).toBeVisible({ timeout: 20_000 })
})

test('manual pairing reaches the hub and survives a reload', async ({ page }) => {
  await startManualPairing(page, 'mock-key-123')
  await page.getByTestId('pair-confirm-add-btn').click({ timeout: 15_000 })
  await page.getByTestId('onboarding-notifications-cta').click({ timeout: 15_000 })
  await page.getByTestId('onboarding-done-cta').click({ timeout: 15_000 })
  await expect(page.getByTestId('hub-screen')).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(page.getByTestId('hub-screen')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('session-row-session-def456')).toBeVisible({ timeout: 15_000 })
})

test('a rejected key shows the error and does not pair', async ({ page }) => {
  await startManualPairing(page, 'wrong-token-000')
  await expect(page.getByText('The server rejected this API key')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('onboarding-connect-handshake-cta')).toBeVisible()
  await expect(page.getByTestId('pair-confirm-add-btn')).toHaveCount(0)
})

test.describe('with a seeded server', () => {
  test.use({ storageState: SEEDED })

  test('hub lists sessions', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('hub-screen')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('session-row-session-def456')).toBeVisible({ timeout: 15_000 })
  })

  test('open a conversation and read its messages', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('day-bucket-earlier').click({ timeout: 20_000 })
    await page.getByTestId('conversation-row-conv-111').click()
    await expect(
      page.getByText('Can you summarize the checkout retry telemetry before the release?'),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('open a session', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('session-row-session-def456').click({ timeout: 20_000 })
    await expect(page.getByTestId('session-detail-screen')).toBeVisible({ timeout: 15_000 })
  })
})
