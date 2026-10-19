import { test, expect } from '@playwright/test'

test.describe('INC-9: Member Logout Session Flow', () => {
  test('direct API contract verification for /api/auth/logout', async ({ request }) => {
    const res = await request.post('/api/auth/logout')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.message).toBe('Logged out successfully.')
  })

  test('safely logs out via header Logout button, clears session, and prevents unauthenticated lobby access', async ({ page, request }) => {
    const email = `inc9-header-logout-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Register account
    const regRes = await request.post('/api/auth/register', { data: { email, password } })
    expect(regRes.status()).toBe(201)

    // 2. Log in
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 3. Confirm Lobby is reached
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    const storedToken = await page.evaluate(() => window.localStorage.getItem('clubconnect_token'))
    expect(storedToken).toBeTruthy()

    // 4. Click header Logout button
    const headerLogout = page.locator('header').getByRole('button', { name: /Log out|Uitloggen/ })
    await headerLogout.click()

    // 5. Confirms safe redirection to Login screen
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Log in to your account|Inloggen op je account/)
    expect(page.url()).toContain('#login')

    // 6. Confirms token removed from localStorage
    const clearedToken = await page.evaluate(() => window.localStorage.getItem('clubconnect_token'))
    expect(clearedToken).toBeNull()

    // 7. Direct navigation to /#lobby without session stays protected on login
    await page.goto('/#lobby')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Log in to your account|Inloggen op je account/)
  })

  test('safely logs out via lobby card body button', async ({ page, request }) => {
    const email = `inc9-card-logout-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Register account
    await request.post('/api/auth/register', { data: { email, password } })

    // 2. Log in
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // 3. Click card body Logout button
    const bodyLogout = page.locator('section').getByRole('button', { name: /Log out|Uitloggen/ })
    await bodyLogout.click()

    // 4. Confirms safe redirection to Login screen
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Log in to your account|Inloggen op je account/)
    const clearedToken = await page.evaluate(() => window.localStorage.getItem('clubconnect_token'))
    expect(clearedToken).toBeNull()
  })
})
