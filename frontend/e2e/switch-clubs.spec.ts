import { test, expect } from '@playwright/test'

test.describe('INC-14: Switch Between Clubs', () => {
  test('direct API contract verification for GET /api/clubs/:id', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.get('/api/clubs/00000000-0000-0000-0000-000000000000')
    expect(unauthRes.status()).toBe(401)

    // 2. Register & login creator and member
    const creatorEmail = `api-creator-switch-${Date.now()}@example.com`
    const strangerEmail = `api-stranger-switch-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: creatorEmail, password } })
    const loginCreatorRes = await request.post('/api/auth/login', { data: { email: creatorEmail, password } })
    const { token: creatorToken } = await loginCreatorRes.json()

    await request.post('/api/auth/register', { data: { email: strangerEmail, password } })
    const loginStrangerRes = await request.post('/api/auth/login', { data: { email: strangerEmail, password } })
    const { token: strangerToken } = await loginStrangerRes.json()

    // 3. Creator creates Club A and Club B
    const clubARes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { name: 'Switch API Club Alpha', description: 'Alpha activities' },
    })
    expect(clubARes.status()).toBe(201)
    const clubA = await clubARes.json()

    const clubBRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { name: 'Switch API Club Beta', description: 'Beta activities' },
    })
    expect(clubBRes.status()).toBe(201)
    const clubB = await clubBRes.json()

    // 4. Creator retrieves Club A details -> 200 with Club Admin role and invite code
    const getAdminRes = await request.get(`/api/clubs/${clubA.id}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    })
    expect(getAdminRes.status()).toBe(200)
    const adminDetail = await getAdminRes.json()
    expect(adminDetail.id).toBe(clubA.id)
    expect(adminDetail.name).toBe('Switch API Club Alpha')
    expect(adminDetail.role).toBe('Club Admin')
    expect(adminDetail.inviteCode).toBe(clubA.inviteCode)

    // 5. Stranger requests Club A before joining -> 403 Forbidden (cross-tenant security isolation)
    const strangerRes = await request.get(`/api/clubs/${clubA.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(strangerRes.status()).toBe(403)

    // 6. Non-existent GUID returns 404
    const notFoundRes = await request.get('/api/clubs/ffffffff-ffff-ffff-ffff-ffffffffffff', {
      headers: { Authorization: `Bearer ${creatorToken}` },
    })
    expect(notFoundRes.status()).toBe(404)

    // 7. Stranger joins Club A using invite code
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: { code: clubA.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 8. Stranger requests Club A after joining -> 200 with Club Member role and null invite code
    const memberDetailRes = await request.get(`/api/clubs/${clubA.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(memberDetailRes.status()).toBe(200)
    const memberDetail = await memberDetailRes.json()
    expect(memberDetail.id).toBe(clubA.id)
    expect(memberDetail.name).toBe('Switch API Club Alpha')
    expect(memberDetail.role).toBe('Club Member')
    expect(memberDetail.inviteCode).toBeNull()

    // 9. Stranger requests Club B (which they did NOT join) -> 403 Forbidden
    const unjoinedRes = await request.get(`/api/clubs/${clubB.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(unjoinedRes.status()).toBe(403)
  })

  test('user switches between multiple clubs via top navigation dropdown and grid CTA', async ({
    page,
    request,
  }) => {
    const userEmail = `multi-club-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register user and create 2 clubs via API
    await request.post('/api/auth/register', { data: { email: userEmail, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email: userEmail, password } })
    const { token } = await loginRes.json()

    await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Leuven Robotics Club', description: 'Autonomous robotics hardware' },
    })

    await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Leuven Chess Guild', description: 'Weekly tournaments and blitz' },
    })

    // Log in via browser
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', userEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Verify Lobby loads
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // 1. Verify switcher trigger is present in top navigation
    const switcherTrigger = page.getByTestId('club-switcher-trigger')
    await expect(switcherTrigger).toBeVisible()

    // By default, first club is active: "Leuven Robotics Club"
    await expect(switcherTrigger).toContainText('Leuven Robotics Club')
    const workspaceBanner = page.getByTestId('active-workspace-banner')
    await expect(workspaceBanner).toBeVisible()
    await expect(workspaceBanner).toContainText('Leuven Robotics Club')

    // 2. Open dropdown and switch to "Leuven Chess Guild"
    await switcherTrigger.click()
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    // Select the second option
    const secondOption = listbox.getByRole('option', { name: /Leuven Chess Guild/i })
    await secondOption.click()

    // Dropdown closes
    await expect(listbox).not.toBeVisible()

    // Verify trigger and banner now show "Leuven Chess Guild"
    await expect(switcherTrigger).toContainText('Leuven Chess Guild')
    await expect(workspaceBanner).toContainText('Leuven Chess Guild')

    // 3. Verify persistence: reload page and ensure active club remains "Leuven Chess Guild"
    await page.reload()
    await expect(switcherTrigger).toBeVisible()
    await expect(switcherTrigger).toContainText('Leuven Chess Guild')
    await expect(workspaceBanner).toContainText('Leuven Chess Guild')

    // 4. Switch back to "Leuven Robotics Club" using the card "Switch to workspace" CTA in the grid
    const roboticsCard = page.locator('article').filter({ hasText: 'Leuven Robotics Club' })
    await expect(roboticsCard).toBeVisible()
    await roboticsCard.getByRole('button', { name: /Switch to workspace|Schakel naar werkruimte/i }).click()

    // Header switcher and banner immediately update back
    await expect(switcherTrigger).toContainText('Leuven Robotics Club')
    await expect(workspaceBanner).toContainText('Leuven Robotics Club')
  })

  test('single-club user sees non-interactive indicator; zero-club user sees no switcher', async ({
    page,
    request,
  }) => {
    const singleEmail = `single-club-${Date.now()}@example.com`
    const zeroEmail = `zero-club-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Single-club user
    await request.post('/api/auth/register', { data: { email: singleEmail, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email: singleEmail, password } })
    const { token } = await loginRes.json()
    await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Sole Club Alpha' },
    })

    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', singleEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Single club indicator visible, but interactive dropdown trigger is NOT present
    await expect(page.getByTestId('club-switcher-single')).toBeVisible()
    await expect(page.getByTestId('club-switcher-single')).toContainText('Sole Club Alpha')
    await expect(page.getByTestId('club-switcher-trigger')).not.toBeVisible()

    // Log out
    await page.getByRole('button', { name: /Log out|Uitloggen/ }).click()

    // 2. Zero-club user
    await page.getByRole('button', { name: /Create account|Account aanmaken/ }).click()
    await page.fill('#email', zeroEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Log in with zero-club user
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', zeroEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Verify empty lobby and neither switcher trigger nor single indicator is present
    await expect(page.getByTestId('lobby-empty-state')).toBeVisible()
    await expect(page.getByTestId('club-switcher-single')).not.toBeVisible()
    await expect(page.getByTestId('club-switcher-trigger')).not.toBeVisible()
  })
})
