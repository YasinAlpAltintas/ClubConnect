import { test, expect } from '@playwright/test'

test.describe('INC-11: Create New Club', () => {
  test('direct API contract verification for POST /api/clubs', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.post('/api/clubs', {
      data: { name: 'Unauthorized Club' },
    })
    expect(unauthRes.status()).toBe(401)

    // 2. Register & login user to get valid token
    const email = `api-create-club-${Date.now()}@example.com`
    const password = 'Passw0rd123!'
    await request.post('/api/auth/register', { data: { email, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email, password } })
    const { token } = await loginRes.json()

    // 3. Validation error on invalid/empty name -> returns 400
    const invalidRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '   ' },
    })
    expect(invalidRes.status()).toBe(400)

    // 4. Successful creation -> returns 201 Created with Club Admin role
    const validRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Leuven Tech Network',
        description: 'Software development and hackathons',
      },
    })
    expect(validRes.status()).toBe(201)
    const club = await validRes.json()
    expect(club.id).toBeTruthy()
    expect(club.name).toBe('Leuven Tech Network')
    expect(club.description).toBe('Software development and hackathons')
    expect(club.role).toBe('Club Admin')

    // 5. Subsequent GET /api/auth/me/clubs returns the created club
    const myClubsRes = await request.get('/api/auth/me/clubs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(myClubsRes.status()).toBe(200)
    const myClubs = await myClubsRes.json()
    expect(myClubs.length).toBe(1)
    expect(myClubs[0].id).toBe(club.id)
    expect(myClubs[0].name).toBe('Leuven Tech Network')
    expect(myClubs[0].role).toBe('Club Admin')
  })

  test('user opens modal, validates club name, and creates club with Club Admin role', async ({
    page,
    request,
  }) => {
    const email = `inc11-creator-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register user
    await request.post('/api/auth/register', { data: { email, password } })

    // Log in
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Verify user arrives in Lobby
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // Initially in empty state
    await expect(page.getByTestId('lobby-empty-state')).toBeVisible()

    // Click "Create New Club" button (using either header or empty state CTA)
    await page.getByRole('button', { name: /Create New Club|Club oprichten/i }).first().click()

    // Verify modal is visible
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(
      /Create New Club|Nieuwe club oprichten/i,
    )

    // Attempt to submit with empty name -> client validation error
    await dialog.getByRole('button', { name: /Create Club|Club aanmaken/i }).click()
    const errorAlert = dialog.getByRole('alert')
    await expect(errorAlert).toBeVisible()
    await expect(errorAlert).toContainText(/required|verplicht/i)

    // Fill valid club name & description
    await page.fill('#club-name', 'Leuven Coding Society')
    await page.fill('#club-description', 'Community of student developers and designers')

    // Submit form
    await dialog.getByRole('button', { name: /Create Club|Club aanmaken/i }).click()

    // Modal closes
    await expect(dialog).not.toBeVisible()

    // Empty state disappears and newly created club card is displayed
    await expect(page.getByTestId('lobby-empty-state')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Leuven Coding Society' })).toBeVisible()
    await expect(
      page.getByText('Community of student developers and designers'),
    ).toBeVisible()
    await expect(page.getByText('Club Admin')).toBeVisible()
    await expect(page.getByText('1 club')).toBeVisible()
  })

  test('multi-tenant isolation: new user does not see clubs created by another user', async ({
    page,
    request,
  }) => {
    const user1Email = `user1-${Date.now()}@example.com`
    const user2Email = `user2-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register user 1 and user 2
    await request.post('/api/auth/register', { data: { email: user1Email, password } })
    await request.post('/api/auth/register', { data: { email: user2Email, password } })

    // User 1 logs in and creates a club via API
    const login1Res = await request.post('/api/auth/login', {
      data: { email: user1Email, password },
    })
    const { token: user1Token } = await login1Res.json()
    await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${user1Token}` },
      data: { name: 'Exclusive Club 1', description: 'User 1 private workspace' },
    })

    // User 2 logs in via browser
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', user2Email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // User 2 must see empty state (not user 1's club)
    await expect(page.getByTestId('lobby-empty-state')).toBeVisible()
    await expect(page.getByText('Exclusive Club 1')).not.toBeVisible()
  })
})
