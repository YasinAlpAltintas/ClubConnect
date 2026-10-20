import { test, expect } from '@playwright/test'

test.describe('INC-10: Empty Lobby with Clear Calls-to-Action', () => {
  test('direct API contract verification for /api/auth/me/clubs', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.get('/api/auth/me/clubs')
    expect(unauthRes.status()).toBe(401)

    // 2. Authenticated request returns 200 with empty array
    const email = `api-clubs-${Date.now()}@example.com`
    const password = 'Passw0rd123!'
    await request.post('/api/auth/register', { data: { email, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email, password } })
    const { token } = await loginRes.json()

    const authRes = await request.get('/api/auth/me/clubs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(authRes.status()).toBe(200)
    const clubs = await authRes.json()
    expect(Array.isArray(clubs)).toBe(true)
    expect(clubs.length).toBe(0)
  })

  test('displays empty lobby with clear calls-to-action and onboarding steps', async ({ page, request }) => {
    const email = `inc10-visitor-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register account
    await request.post('/api/auth/register', { data: { email, password } })

    // Log in
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Confirm Lobby is reached
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // Confirm Empty State container
    const emptyState = page.getByTestId('lobby-empty-state')
    await expect(emptyState).toBeVisible()
    await expect(emptyState.getByRole('heading', { level: 3 })).toHaveText(
      /You haven't joined any clubs yet|Je bent nog geen lid van een club/,
    )

    // Confirm CTAs exist and are visible
    await expect(emptyState.getByRole('button', { name: /Explore Clubs|Ontdek clubs/ })).toBeVisible()
    await expect(emptyState.getByRole('button', { name: /Create New Club|Register a Club|Club oprichten/i })).toBeVisible()
    await expect(emptyState.getByRole('button', { name: /Join Club|Deelnemen/ })).toBeVisible()
    await expect(emptyState.getByPlaceholder(/CLUB-2026/)).toBeVisible()

    // Confirm 3 guided steps
    await expect(emptyState.getByText(/Discover Communities|Ontdek verenigingen/)).toBeVisible()
    await expect(emptyState.getByText(/Connect & Network|Maak connecties/)).toBeVisible()
    await expect(emptyState.getByText(/Attend Events|Neem deel aan evenementen/)).toBeVisible()
  })

  test('interacts with Explore Clubs and Register Club modals', async ({ page, request }) => {
    const email = `inc10-modals-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email, password } })

    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // 1. Open Explore Clubs modal
    await page.getByRole('button', { name: /Explore Clubs|Ontdek clubs/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(/Club Discovery|Clubverkenning/)

    // Close modal
    await dialog.getByRole('button', { name: /Got it|Begrepen/ }).click()
    await expect(dialog).not.toBeVisible()

    // 2. Open Register a Club modal
    await page.getByRole('button', { name: /Create New Club|Register a Club|Club oprichten/i }).first().click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(/Create New Club|Register a New Club|Een nieuwe club oprichten|Nieuwe club oprichten/i)

    // Close modal via Cancel button or close icon
    await dialog.getByRole('button', { name: /Cancel|Annuleren|Got it|Begrepen/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('submits invite code with validation in empty lobby', async ({ page, request }) => {
    const email = `inc10-code-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email, password } })

    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // 1. Submit empty code -> error alert
    await page.getByRole('button', { name: /Join Club|Deelnemen/ }).click()
    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible()

    // 2. Type valid code -> success notice
    await page.fill('#invite-code', 'CAMPUS-ROBOTICS-2026')
    await page.getByRole('button', { name: /Join Club|Deelnemen/ }).click()

    const status = page.locator('[role="status"]')
    await expect(status).toBeVisible()
    await expect(status).toContainText(/Invite code validated|Uitnodigingscode gevalideerd/i)
  })

  test('switches language dynamically in empty lobby state', async ({ page, request }) => {
    const email = `inc10-lang-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email, password } })

    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Club Lobby')

    // Switch to Dutch
    const toggleBtn = page.getByRole('button', { name: /Nederlands/ })
    await toggleBtn.click()

    // Verify Dutch translations
    await expect(page.getByRole('heading', { level: 3 })).toHaveText('Je bent nog geen lid van een club')
    await expect(page.getByRole('button', { name: 'Ontdek clubs' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Club oprichten' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Deelnemen' })).toBeVisible()
  })
})
