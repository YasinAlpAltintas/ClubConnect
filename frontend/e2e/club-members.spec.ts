import { test, expect } from '@playwright/test'

test.describe('INC-15: View Club Members', () => {
  test('direct API contract verification for GET /api/clubs/:id/members', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.get('/api/clubs/00000000-0000-0000-0000-000000000000/members')
    expect(unauthRes.status()).toBe(401)

    // 2. Register & login Admin A, Admin B, and ordinary Member
    const adminAEmail = `admin-a-api-${Date.now()}@example.com`
    const adminBEmail = `admin-b-api-${Date.now()}@example.com`
    const memberEmail = `member-api-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: adminAEmail, password } })
    const loginARes = await request.post('/api/auth/login', { data: { email: adminAEmail, password } })
    const { token: tokenA } = await loginARes.json()

    await request.post('/api/auth/register', { data: { email: adminBEmail, password } })
    const loginBRes = await request.post('/api/auth/login', { data: { email: adminBEmail, password } })
    const { token: tokenB } = await loginBRes.json()

    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: tokenMember } = await loginMemberRes.json()

    // 3. Admin A creates Club Alpha
    const clubAlphaRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { name: 'Alpha Robotics Society', description: 'Advanced robotics' },
    })
    expect(clubAlphaRes.status()).toBe(201)
    const clubAlpha = await clubAlphaRes.json()

    // 4. Admin B creates Club Beta
    const clubBetaRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { name: 'Beta Chess Guild', description: 'Competitive chess' },
    })
    expect(clubBetaRes.status()).toBe(201)
    const clubBeta = await clubBetaRes.json()

    // 5. Member joins Club Alpha
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${tokenMember}` },
      data: { code: clubAlpha.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 6. Admin A retrieves Club Alpha members -> 200 OK with Admin A & Member
    const adminGetMembersRes = await request.get(`/api/clubs/${clubAlpha.id}/members`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(adminGetMembersRes.status()).toBe(200)
    const alphaMembers = await adminGetMembersRes.json()
    expect(Array.isArray(alphaMembers)).toBe(true)
    expect(alphaMembers.length).toBe(2)

    const adminItem = alphaMembers.find((m: { role: string }) => m.role === 'Club Admin')
    expect(adminItem).toBeDefined()
    expect(adminItem.email).toBe(adminAEmail)

    const memberItem = alphaMembers.find((m: { role: string }) => m.role === 'Club Member')
    expect(memberItem).toBeDefined()
    expect(memberItem.email).toBe(memberEmail)

    // 7. Ordinary Member requests Club Alpha members -> 403 Forbidden (Non-admin member blocked)
    const memberGetMembersRes = await request.get(`/api/clubs/${clubAlpha.id}/members`, {
      headers: { Authorization: `Bearer ${tokenMember}` },
    })
    expect(memberGetMembersRes.status()).toBe(403)

    // 8. Admin B (outsider) requests Club Alpha members -> 403 Forbidden (Cross-tenant security isolation)
    const outsiderGetMembersRes = await request.get(`/api/clubs/${clubAlpha.id}/members`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    expect(outsiderGetMembersRes.status()).toBe(403)
  })

  test('Club Admin views members table, switches between clubs, and returns to dashboard', async ({
    page,
    request,
  }) => {
    const adminEmail = `admin-ui-${Date.now()}@example.com`
    const memberEmail = `member-ui-${Date.now()}@example.com`
    const adminName = 'AI Society Admin'
    const memberName = 'Cyber Member'
    const password = 'Passw0rd123!'

    // 1. Register admin & create 2 clubs via API
    await request.post('/api/auth/register', { data: { email: adminEmail, password, displayName: adminName } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    const club1Res = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven AI Society', description: 'Machine learning & deep learning' },
    })
    const club1 = await club1Res.json()

    const club2Res = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven Cyber Security', description: 'Ethical hacking & CTF' },
    })
    const club2 = await club2Res.json()

    // 2. Register member and join Club 1
    await request.post('/api/auth/register', { data: { email: memberEmail, password, displayName: memberName } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken } = await loginMemberRes.json()

    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club1.inviteCode },
    })

    // 3. Log in as Club Admin via browser UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', adminEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 4. Enter Club 1 Dashboard from Lobby
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club1.id}`).click()

    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Leuven AI Society')
    expect(page.url()).toContain(`#dashboard/${club1.id}`)

    // 5. Open Members overview via "Members" button
    const membersBtn = page.getByTestId('dashboard-members-btn')
    await expect(membersBtn).toBeVisible()
    await membersBtn.click()

    // 6. Verify Members page header and table contents
    await expect(page.getByTestId('members-page-heading')).toHaveText(/Club Members|Clubleden/i)
    await expect(page.getByTestId('club-members-table')).toBeVisible()

    // Verify 2 members are listed (Admin and joined Member)
    await expect(page.getByText(adminName)).toBeVisible()
    await expect(page.locator('[data-testid^="member-email-"]', { hasText: adminEmail })).toBeVisible()
    await expect(page.getByText(memberName)).toBeVisible()
    await expect(page.locator('[data-testid^="member-email-"]', { hasText: memberEmail })).toBeVisible()

    const adminRoleBadge = page.getByText(/Club Admin|Clubbeheerder/i)
    await expect(adminRoleBadge.first()).toBeVisible()

    const memberRoleBadge = page.getByText(/Club Member|Clublid/i)
    await expect(memberRoleBadge.first()).toBeVisible()

    // 7. Test fast club switcher inside Members view: switch to Club 2
    const switcherTrigger = page.getByTestId('club-switcher-trigger')
    await switcherTrigger.click()

    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()
    await listbox.getByRole('option', { name: /Leuven Cyber Security/i }).click()

    // URL and table update to Club 2
    await expect(page.getByTestId('members-page-heading')).toHaveText(/Club Members|Clubleden/i)
    await expect(page.getByTestId('members-page-subtitle')).toContainText('Leuven Cyber Security')
    await expect(page.getByTestId('club-switcher-trigger')).toContainText('Leuven Cyber Security')

    // In Club 2: Admin is present, but memberName/memberEmail is NOT a member of Club 2!
    await expect(page.getByText(adminName)).toBeVisible()
    await expect(page.locator('[data-testid^="member-email-"]', { hasText: adminEmail })).toBeVisible()
    await expect(page.getByText(memberName)).not.toBeVisible()
    await expect(page.locator('[data-testid^="member-email-"]', { hasText: memberEmail })).not.toBeVisible()

    // 8. Return to Dashboard Overview via Back button
    const backToDashLink = page.getByTestId('back-to-dashboard-link')
    await backToDashLink.click()

    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Leuven Cyber Security')
  })

  test('ordinary Club Member cannot access admin members overview via UI or direct URL', async ({
    page,
    request,
  }) => {
    const adminEmail = `admin-protect-${Date.now()}@example.com`
    const memberEmail = `member-protect-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Admin creates club
    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven Debate Union', description: 'Parliamentary debate' },
    })
    const club = await clubRes.json()

    // 2. Member joins club
    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken } = await loginMemberRes.json()

    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })

    // 3. Member logs in via UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', memberEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 4. Enter dashboard
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()

    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Leuven Debate Union')

    // 5. Verify Members button is NOT visible for ordinary member
    await expect(page.getByTestId('dashboard-members-btn')).not.toBeVisible()
    await expect(page.getByTestId('dashboard-members-nav-btn')).not.toBeVisible()

    // 6. Direct URL navigation attempt to members view (#dashboard/:id/members)
    await page.goto(`/#dashboard/${club.id}/members`)

    // 7. Verify Access Denied screen appears
    await expect(page.getByTestId('dashboard-access-denied')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Access Denied|Toegang geweigerd/i })).toBeVisible()
    await expect(
      page.getByText(/You do not have administrative access|Je hebt geen beheerdersrechten/i)
    ).toBeVisible()

    // 8. Return to dashboard safely
    await page.getByTestId('access-denied-dashboard-btn').click()
    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Leuven Debate Union')
  })
})
