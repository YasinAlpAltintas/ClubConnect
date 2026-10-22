import { test, expect } from '@playwright/test'

test.describe('INC-12: Join Club Using Invite Code', () => {
  test('direct API contract verification for POST /api/clubs/join', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.post('/api/clubs/join', {
      data: { code: '123456' },
    })
    expect(unauthRes.status()).toBe(401)

    // 2. Register & login club creator
    const creatorEmail = `api-creator-${Date.now()}@example.com`
    const joinerEmail = `api-joiner-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: creatorEmail, password } })
    const loginCreatorRes = await request.post('/api/auth/login', { data: { email: creatorEmail, password } })
    const { token: creatorToken } = await loginCreatorRes.json()

    // 3. Creator creates a club and receives invite code
    const createRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { name: 'Leuven AI Network', description: 'Machine learning and data science' },
    })
    expect(createRes.status()).toBe(201)
    const createdClub = await createRes.json()
    const inviteCode = createdClub.inviteCode
    expect(inviteCode).toBeTruthy()
    expect(inviteCode).toMatch(/^\d{6}$/)

    // 4. Register & login joiner
    await request.post('/api/auth/register', { data: { email: joinerEmail, password } })
    const loginJoinerRes = await request.post('/api/auth/login', { data: { email: joinerEmail, password } })
    const { token: joinerToken } = await loginJoinerRes.json()

    // 5. Joiner attempts invalid formats -> returns 400
    const invalidFmtRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${joinerToken}` },
      data: { code: '123' },
    })
    expect(invalidFmtRes.status()).toBe(400)

    // 6. Joiner attempts unknown code -> returns 404
    const notFoundRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${joinerToken}` },
      data: { code: '999999' },
    })
    expect(notFoundRes.status()).toBe(404)

    // 7. Joiner joins with valid code -> returns 200 with Club Member role
    const validJoinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${joinerToken}` },
      data: { code: inviteCode },
    })
    expect(validJoinRes.status()).toBe(200)
    const joinData = await validJoinRes.json()
    expect(joinData.clubId).toBe(createdClub.id)
    expect(joinData.name).toBe('Leuven AI Network')
    expect(joinData.role).toBe('Club Member')

    // 8. Joiner calls /api/auth/me/clubs -> sees the club as Club Member
    const joinerClubsRes = await request.get('/api/auth/me/clubs', {
      headers: { Authorization: `Bearer ${joinerToken}` },
    })
    expect(joinerClubsRes.status()).toBe(200)
    const joinerClubs = await joinerClubsRes.json()
    expect(joinerClubs.length).toBe(1)
    expect(joinerClubs[0].id).toBe(createdClub.id)
    expect(joinerClubs[0].role).toBe('Club Member')
    expect(joinerClubs[0].inviteCode).toBeNull()

    // 9. Joiner tries to join the same club again -> returns 409 Conflict
    const dupJoinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${joinerToken}` },
      data: { code: inviteCode },
    })
    expect(dupJoinRes.status()).toBe(409)
  })

  test('user joins an existing club from empty lobby using 6-digit invite code', async ({
    page,
    request,
  }) => {
    const creatorEmail = `creator-e2e-${Date.now()}@example.com`
    const joinerEmail = `joiner-empty-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register creator and create club
    await request.post('/api/auth/register', { data: { email: creatorEmail, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email: creatorEmail, password } })
    const { token } = await loginRes.json()
    const createRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Campus Astronomy Club', description: 'Stargazing and telescopes' },
    })
    const { inviteCode } = await createRes.json()
    expect(inviteCode).toBeTruthy()

    // Register joiner
    await request.post('/api/auth/register', { data: { email: joinerEmail, password } })

    // Joiner logs in via browser
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', joinerEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Verify Lobby empty state
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await expect(page.getByTestId('lobby-empty-state')).toBeVisible()

    // Enter invite code in the inline empty-state input
    const inlineInput = page.locator('#invite-code')
    await expect(inlineInput).toBeVisible()
    await inlineInput.fill(inviteCode)

    // Submit form
    await page.locator('form').filter({ has: inlineInput }).locator('button[type="submit"]').click()

    // Empty state disappears and joined club card is displayed
    await expect(page.getByTestId('lobby-empty-state')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Campus Astronomy Club' })).toBeVisible()
    await expect(page.getByText('Stargazing and telescopes')).toBeVisible()
    await expect(page.getByText('Club Member')).toBeVisible()
    await expect(page.getByText('1 club')).toBeVisible()
  })

  test('user joins another club from populated lobby using modal', async ({
    page,
    request,
  }) => {
    const creatorEmail = `creator-pop-${Date.now()}@example.com`
    const joinerEmail = `joiner-pop-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register creator and create 2 clubs
    await request.post('/api/auth/register', { data: { email: creatorEmail, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email: creatorEmail, password } })
    const { token } = await loginRes.json()

    const club1Res = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'First Club Alpha', description: 'Alpha activities' },
    })
    const { inviteCode: code1 } = await club1Res.json()

    const club2Res = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Second Club Beta', description: 'Beta activities' },
    })
    const { inviteCode: code2 } = await club2Res.json()

    // Register joiner and pre-join Club 1 via API
    await request.post('/api/auth/register', { data: { email: joinerEmail, password } })
    const joinerLogin = await request.post('/api/auth/login', { data: { email: joinerEmail, password } })
    const { token: joinerToken } = await joinerLogin.json()
    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${joinerToken}` },
      data: { code: code1 },
    })

    // Joiner logs in via browser
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', joinerEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Initially sees 1 club (populated lobby)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await expect(page.getByRole('heading', { name: 'First Club Alpha' })).toBeVisible()
    await expect(page.getByText('1 club')).toBeVisible()

    // Click "Join Club" button in the header
    await page.getByRole('button', { name: /Join Club|Club binnengaan/i }).click()

    // Modal dialog is shown
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(/Join a Club|Deelnemen aan een club/i)

    // Enter club 2 invite code
    await dialog.locator('#modal-invite-code').fill(code2)

    // Submit modal
    await dialog.getByRole('button', { name: /Join Club|Club binnengaan/i }).click()

    // Modal closes
    await expect(dialog).not.toBeVisible()

    // Now lobby shows 2 clubs
    await expect(page.getByText('2 clubs')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'First Club Alpha' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Second Club Beta' })).toBeVisible()
  })
})
