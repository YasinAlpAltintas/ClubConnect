import { test, expect } from '@playwright/test'

test.describe('INC-13: Access Club Dashboard from Lobby', () => {
  test('direct API contract verification for GET /api/clubs/:id', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.get('/api/clubs/00000000-0000-0000-0000-000000000000')
    expect(unauthRes.status()).toBe(401)

    // 2. Register & login creator and member
    const creatorEmail = `api-creator-dash-${Date.now()}@example.com`
    const strangerEmail = `api-stranger-dash-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: creatorEmail, password } })
    const loginCreatorRes = await request.post('/api/auth/login', { data: { email: creatorEmail, password } })
    const { token: creatorToken } = await loginCreatorRes.json()

    await request.post('/api/auth/register', { data: { email: strangerEmail, password } })
    const loginStrangerRes = await request.post('/api/auth/login', { data: { email: strangerEmail, password } })
    const { token: strangerToken } = await loginStrangerRes.json()

    // 3. Creator creates Club Alpha and Club Beta
    const clubAlphaRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { name: 'Dash API Club Alpha', description: 'Alpha activities and workspace' },
    })
    expect(clubAlphaRes.status()).toBe(201)
    const clubAlpha = await clubAlphaRes.json()

    const clubBetaRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { name: 'Dash API Club Beta', description: 'Beta activities and workspace' },
    })
    expect(clubBetaRes.status()).toBe(201)
    const clubBeta = await clubBetaRes.json()

    // 4. Creator retrieves Club Alpha details -> 200 with Club Admin role and invite code
    const getAdminRes = await request.get(`/api/clubs/${clubAlpha.id}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    })
    expect(getAdminRes.status()).toBe(200)
    const adminDetail = await getAdminRes.json()
    expect(adminDetail.id).toBe(clubAlpha.id)
    expect(adminDetail.name).toBe('Dash API Club Alpha')
    expect(adminDetail.role).toBe('Club Admin')
    expect(adminDetail.inviteCode).toBe(clubAlpha.inviteCode)

    // 5. Stranger requests Club Alpha before joining -> 403 Forbidden (cross-tenant security boundary)
    const strangerBeforeJoinRes = await request.get(`/api/clubs/${clubAlpha.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(strangerBeforeJoinRes.status()).toBe(403)

    // 6. Stranger joins Club Alpha using invite code
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: { code: clubAlpha.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 7. Stranger retrieves Club Alpha after joining -> 200 with Club Member role and null invite code
    const memberDetailRes = await request.get(`/api/clubs/${clubAlpha.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(memberDetailRes.status()).toBe(200)
    const memberDetail = await memberDetailRes.json()
    expect(memberDetail.id).toBe(clubAlpha.id)
    expect(memberDetail.name).toBe('Dash API Club Alpha')
    expect(memberDetail.role).toBe('Club Member')
    expect(memberDetail.inviteCode).toBeNull()

    // 8. Stranger requests Club Beta (which they did NOT join) -> 403 Forbidden
    const unjoinedRes = await request.get(`/api/clubs/${clubBeta.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(unjoinedRes.status()).toBe(403)
  })

  test('user enters club dashboard from lobby, views dashboard modules, switches club, and returns to lobby', async ({
    page,
    request,
  }) => {
    const userEmail = `dash-user-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register user and create 2 clubs via API
    await request.post('/api/auth/register', { data: { email: userEmail, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email: userEmail, password } })
    const { token } = await loginRes.json()

    const club1Res = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Leuven Robotics Society', description: 'Robotics and drone development team' },
    })
    const club1 = await club1Res.json()

    const club2Res = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Leuven Chess Masters', description: 'Competitive chess tournaments' },
    })
    const club2 = await club2Res.json()

    // Log in via browser UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', userEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 1. Verify Lobby loads and contains "Enter Dashboard" CTA on club cards
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    const enterClub1Btn = page.getByTestId(`enter-dashboard-${club1.id}`)
    const enterClub2Btn = page.getByTestId(`enter-dashboard-${club2.id}`)
    await expect(enterClub1Btn).toBeVisible()
    await expect(enterClub2Btn).toBeVisible()

    // 2. Click "Enter Dashboard →" on Club 1 (Leuven Robotics Society)
    await enterClub1Btn.click()

    // 3. Verify Dashboard view is displayed for Club 1
    const dashboardPage = page.getByTestId('club-dashboard-page')
    await expect(dashboardPage).toBeVisible()

    const clubNameHeading = page.getByTestId('dashboard-club-name')
    await expect(clubNameHeading).toHaveText('Leuven Robotics Society')

    const roleBadge = page.getByTestId('dashboard-role-badge')
    await expect(roleBadge).toHaveText(/Club Admin|Clubbeheerder/)

    const clubDesc = page.getByTestId('dashboard-club-description')
    await expect(clubDesc).toHaveText('Robotics and drone development team')

    // 4. Verify Invite Code section is present for Club Admin
    const inviteSection = page.getByTestId('dashboard-invite-code-section')
    await expect(inviteSection).toBeVisible()
    await expect(inviteSection).toContainText(club1.inviteCode)
    await expect(page.getByTestId('dashboard-copy-invite-code')).toBeVisible()

    // 5. Verify the 3 Module Placeholder Cards with Coming Soon badges
    await expect(page.getByText(/Calendar & Events|Kalender & Evenementen/i)).toBeVisible()
    await expect(page.getByText(/Kanban Task Board|Kanban-takenbord/i)).toBeVisible()
    await expect(page.getByText(/Logistics & Inventory|Logistiek & Voorraad/i)).toBeVisible()
    const comingSoonBadges = page.getByText(/Coming Soon|Binnenkort beschikbaar/i)
    await expect(comingSoonBadges).toHaveCount(3)

    // 6. Test "← Back to Lobby" navigation
    const backBtn = page.getByTestId('back-to-lobby-btn')
    await expect(backBtn).toBeVisible()
    await backBtn.click()

    // Verify returned to Lobby
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // 7. Click "Enter Dashboard →" on Club 2 (Leuven Chess Masters)
    await page.getByTestId(`enter-dashboard-${club2.id}`).click()
    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Leuven Chess Masters')
    await expect(page.getByTestId('dashboard-club-description')).toHaveText('Competitive chess tournaments')

    // 8. Test fast club switching inside Dashboard using top navigation ClubSwitcherDropdown
    const switcherTrigger = page.getByTestId('club-switcher-trigger')
    await expect(switcherTrigger).toBeVisible()
    await switcherTrigger.click()

    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()
    await listbox.getByRole('option', { name: /Leuven Robotics Society/i }).click()

    // Dashboard immediately updates to Club 1
    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Leuven Robotics Society')
    await expect(page.getByTestId('dashboard-club-description')).toHaveText('Robotics and drone development team')

    // 9. Test persistence on page reload
    await page.reload()
    await expect(page.getByTestId('club-dashboard-page')).toBeVisible()
    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Leuven Robotics Society')

    // 10. Test Back to Lobby from reloaded dashboard
    await page.getByTestId('back-to-lobby-btn').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
  })

  test('cross-tenant security isolation: navigating to non-member club displays Access Denied', async ({
    page,
    request,
  }) => {
    const userEmail = `tenant-check-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // Register user
    await request.post('/api/auth/register', { data: { email: userEmail, password } })

    // Log in via browser
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', userEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Wait for Lobby
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)

    // User attempts to access a club they do not belong to
    await page.goto('/#dashboard/00000000-0000-0000-0000-000000000000')

    // Access Denied screen appears
    const accessDenied = page.getByTestId('dashboard-access-denied')
    await expect(accessDenied).toBeVisible()
    await expect(page.getByRole('heading', { name: /Access Denied|Toegang geweigerd/i })).toBeVisible()
    await expect(page.getByText(/You do not have access to this club or you are not a member\.|Je hebt geen toegang tot deze club/i)).toBeVisible()

    // Back to Lobby button safely restores user to Lobby
    await page.getByTestId('back-to-lobby-btn').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
  })
})
