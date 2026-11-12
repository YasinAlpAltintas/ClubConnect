import { test, expect } from '@playwright/test'

test.describe('INC-16: View and Share Club Invite Code', () => {
  test('direct API contract verification: inviteCode is returned to Club Admin and hidden from Club Member', async ({
    request,
  }) => {
    // 1. Create Admin and Member accounts
    const adminEmail = `inc16-admin-api-${Date.now()}@example.com`
    const memberEmail = `inc16-member-api-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken } = await loginMemberRes.json()

    // 2. Admin creates club -> 201 with 6-digit invite code
    const createClubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven AI Innovators', description: 'Machine learning & autonomous agents' },
    })
    expect(createClubRes.status()).toBe(201)
    const club = await createClubRes.json()
    expect(club.inviteCode).toMatch(/^\d{6}$/)

    // 3. Admin fetches club details -> 200 with inviteCode populated
    const adminGetClubRes = await request.get(`/api/clubs/${club.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(adminGetClubRes.status()).toBe(200)
    const adminClubDetail = await adminGetClubRes.json()
    expect(adminClubDetail.inviteCode).toBe(club.inviteCode)
    expect(adminClubDetail.role).toBe('Club Admin')

    // 4. Member joins club using the 6-digit invite code
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 5. Member fetches club details -> 200 with inviteCode strictly null
    const memberGetClubRes = await request.get(`/api/clubs/${club.id}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    expect(memberGetClubRes.status()).toBe(200)
    const memberClubDetail = await memberGetClubRes.json()
    expect(memberClubDetail.role).toBe('Club Member')
    expect(memberClubDetail.inviteCode).toBeNull()
  })

  test('Club Admin views and copies 6-digit invite code in dashboard overview and members view; hidden for regular members', async ({
    page,
    request,
  }) => {
    const adminEmail = `inc16-ui-admin-${Date.now()}@example.com`
    const memberEmail = `inc16-ui-member-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Register admin via API and create club
    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven Solar Team', description: 'Building solar racing cars' },
    })
    const club = await clubRes.json()
    const inviteCode = club.inviteCode
    expect(inviteCode).toMatch(/^\d{6}$/)

    // 2. Admin logs in via browser UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', adminEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Enter club dashboard
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await expect(page.getByTestId('club-dashboard-page')).toBeVisible()

    // 3. Verify Invite Code display in Dashboard overview
    const overviewInviteSection = page.getByTestId('dashboard-invite-code-section')
    await expect(overviewInviteSection).toBeVisible()
    await expect(overviewInviteSection).toContainText(inviteCode)

    const copyOverviewBtn = page.getByTestId('dashboard-copy-invite-code')
    await expect(copyOverviewBtn).toBeVisible()
    await copyOverviewBtn.click()
    await expect(copyOverviewBtn).toContainText(/Copied!|Gekopieerd!/i)

    // 4. Navigate to Club Members view
    await page.getByTestId('dashboard-members-btn').click()
    await expect(page.getByTestId('members-page-heading')).toBeVisible()

    // 5. Verify dedicated InviteCodeCard in Members view
    const membersInviteCard = page.getByTestId('members-invite-code-card')
    await expect(membersInviteCard).toBeVisible()
    await expect(page.getByTestId('invite-code-value')).toHaveText(inviteCode)

    const copyMembersBtn = page.getByTestId('members-copy-invite-code')
    await expect(copyMembersBtn).toBeVisible()
    await copyMembersBtn.click()
    await expect(page.getByTestId('copy-feedback-message')).toBeVisible()

    // 6. Log out admin and register/login ordinary member
    await page.getByTestId('dashboard-logout-btn').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Create your account|Log in/)

    // Register & join as member
    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken } = await loginMemberRes.json()

    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: inviteCode },
    })

    // Log in as member via UI
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', memberEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Member enters dashboard
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await expect(page.getByTestId('club-dashboard-page')).toBeVisible()

    // 7. Verify Invite Code is strictly hidden for Member
    await expect(page.getByTestId('dashboard-invite-code-section')).not.toBeVisible()
    await expect(page.getByTestId('dashboard-members-btn')).not.toBeVisible()
  })
})
