import { test, expect } from '@playwright/test'

// PROD sanity check (step 12 of the testing process).
// Every check here is READ-ONLY: it never creates accounts, clubs or other data,
// so it is safe to run against production right after a release.
test.describe('Release sanity check @sanity', () => {
  test('frontend is served and the login page renders', async ({ page }) => {
    await page.goto('/#login')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Log in to your account|Inloggen op je account/)
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('API is reachable and can query the database', async ({ request }) => {
    const res = await request.get('/api/auth/check-email?email=sanity-check@example.com')

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('exists')
  })

  test('API rejects unauthenticated profile requests', async ({ request }) => {
    const res = await request.get('/api/auth/me')

    expect(res.status()).toBe(401)
  })
})
