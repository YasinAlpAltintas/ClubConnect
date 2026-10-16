import { test, expect } from '@playwright/test'

test.describe('Member Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('successfully registers a new club member account', async ({ page }) => {
    const uniqueEmail = `member-${Date.now()}@example.com`
    const validPassword = 'Passw0rd123!'

    await page.fill('#email', uniqueEmail)
    await page.fill('#password', validPassword)
    await page.click('button[type="submit"]')

    // Verify success confirmation view is rendered
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Account created|Account aangemaakt/)
    await expect(page.locator('p')).toContainText(uniqueEmail)
  })

  test('displays validation errors on invalid input', async ({ page }) => {
    await page.fill('#email', 'invalid-email-format')
    await page.fill('#password', '123')
    await page.click('button[type="submit"]')

    // Client-side schema error feedback should be visible
    await expect(page.locator('#email-error')).toBeVisible()
    await expect(page.locator('#password-error')).toBeVisible()
  })

  test('displays conflict error when registering duplicate email', async ({ page }) => {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`
    const validPassword = 'Passw0rd123!'

    // First registration
    await page.fill('#email', duplicateEmail)
    await page.fill('#password', validPassword)
    await page.click('button[type="submit"]')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Account created|Account aangemaakt/)

    // Attempt second registration with the same email
    await page.goto('/')
    await page.fill('#email', duplicateEmail)
    await page.fill('#password', validPassword)
    await page.click('button[type="submit"]')

    // Conflict error banner should be visible
    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/already exists|bestaat al/)
  })
})
