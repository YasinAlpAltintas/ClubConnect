import { test, expect } from '@playwright/test'

test.describe('Member Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('navigates from registration to login page', async ({ page }) => {
    // Click navigation button to log in
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Log in to your account|Inloggen op je account/)
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('displays client validation errors for invalid input', async ({ page }) => {
    await page.goto('/#login')

    // Submit empty fields
    await page.click('button[type="submit"]')
    await expect(page.locator('#email-error')).toBeVisible()
    await expect(page.locator('#password-error')).toBeVisible()

    // Invalid email format on blur
    await page.fill('#email', 'invalid-email-format')
    await page.locator('#password').focus()
    await expect(page.locator('#email-error')).toBeVisible()
  })

  test('displays invalid credentials alert for unknown credentials (401)', async ({ page }) => {
    await page.goto('/#login')

    await page.fill('#email', 'nonexistent-user@example.com')
    await page.fill('#password', 'WrongPassword123!')
    await page.click('button[type="submit"]')

    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/Invalid e-mail address or password|Ongeldig e-mailadres of wachtwoord/)
  })

  test('successfully registers, logs in to Lobby, and logs out', async ({ page }) => {
    const uniqueEmail = `login-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
    const validPassword = 'Passw0rd123!'

    // 1. Register a new member
    await page.fill('#email', uniqueEmail)
    await page.fill('#password', validPassword)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Account created|Account aangemaakt/)

    // 2. Click login button from success screen
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Log in to your account|Inloggen op je account/)

    // 3. Log in with registered credentials
    await page.fill('#email', uniqueEmail)
    await page.fill('#password', validPassword)
    await page.click('button[type="submit"]')

    // 4. Verify Lobby is reached
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await expect(page.locator('main')).toContainText(uniqueEmail)

    // 5. Log out back to login screen
    await page.getByRole('button', { name: /Log out|Uitloggen/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Log in to your account|Inloggen op je account/)
  })

  test('direct backend API contract validation (400 and 401)', async ({ request }) => {
    // 400 Bad Request on empty payload
    const badRequest = await request.post('/api/auth/login', {
      data: { email: '', password: '' },
    })
    expect(badRequest.status()).toBe(400)
    const badBody = await badRequest.json()
    expect(badBody.error).toBe('invalid_input')

    // 401 Unauthorized on invalid credentials
    const unauthorized = await request.post('/api/auth/login', {
      data: { email: 'nobody@example.com', password: 'BadPassword1' },
    })
    expect(unauthorized.status()).toBe(401)
    const unauthBody = await unauthorized.json()
    expect(unauthBody.error).toBe('invalid_credentials')
  })
})
