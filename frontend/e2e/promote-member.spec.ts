import { test, expect } from '@playwright/test'

test.describe('INC-17: Promote Club Member to Club Admin', () => {
  test('direct API contract verification: only Club Admin can promote member to Club Admin', async ({
    request,
  }) => {
    // 1. Unauthenticated PATCH returns 401
    const unauthRes = await request.patch(
      '/api/clubs/00000000-0000-0000-0000-000000000000/members/00000000-0000-0000-0000-000000000000/role',
      { data: { role: 'Club Admin' } }
    )
    expect(unauthRes.status()).toBe(401)

    // 2. Register Admin, Member, and Stranger
    const adminEmail = `inc17-admin-api-${Date.now()}@example.com`
    const memberEmail = `inc17-member-api-${Date.now()}@example.com`
    const strangerEmail = `inc17-stranger-api-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken, memberId } = await loginMemberRes.json()

    await request.post('/api/auth/register', { data: { email: strangerEmail, password } })
    const loginStrangerRes = await request.post('/api/auth/login', { data: { email: strangerEmail, password } })
    const { token: strangerToken } = await loginStrangerRes.json()

    // 3. Admin creates club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven Tech Innovators', description: 'Student technology collaborative' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 4. Member joins club using invite code
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 5. Member (non-admin) tries to promote someone -> 403 Forbidden
    const forbiddenRes = await request.patch(`/api/clubs/${club.id}/members/${memberId}/role`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { role: 'Club Admin' },
    })
    expect(forbiddenRes.status()).toBe(403)

    // 6. Stranger (not in club) tries to promote -> 403 Forbidden
    const strangerRes = await request.patch(`/api/clubs/${club.id}/members/${memberId}/role`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: { role: 'Club Admin' },
    })
    expect(strangerRes.status()).toBe(403)

    // 7. Invalid role -> 400 Bad Request
    const invalidRoleRes = await request.patch(`/api/clubs/${club.id}/members/${memberId}/role`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { role: 'SuperUser' },
    })
    expect(invalidRoleRes.status()).toBe(400)

    // 8. Admin promotes Member to Club Admin -> 200 OK
    const promoteRes = await request.patch(`/api/clubs/${club.id}/members/${memberId}/role`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { role: 'Club Admin' },
    })
    expect(promoteRes.status()).toBe(200)
    const updated = await promoteRes.json()
    expect(updated.role).toBe('Club Admin')
    expect(updated.memberId).toBe(memberId)

    // 9. Verify member now has Club Admin permissions and receives invite code on GET /api/clubs/:id
    const memberGetClubRes = await request.get(`/api/clubs/${club.id}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    expect(memberGetClubRes.status()).toBe(200)
    const promotedClubDetails = await memberGetClubRes.json()
    expect(promotedClubDetails.role).toBe('Club Admin')
    expect(promotedClubDetails.inviteCode).toBe(club.inviteCode)
  })

  test('Club Admin promotes a Club Member to Club Admin in UI; promoted member gains admin privileges', async ({
    page,
    request,
  }) => {
    const adminEmail = `inc17-ui-admin-${Date.now()}@example.com`
    const memberEmail = `inc17-ui-member-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Register admin via API and create club
    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven Rocketry Guild', description: 'Aerospace and rocket propulsion' },
    })
    const club = await clubRes.json()

    // 2. Register member via API and join club
    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken, memberId } = await loginMemberRes.json()

    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })

    // 3. Admin logs in via browser UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', adminEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Navigate to Club Dashboard
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await expect(page.getByTestId('club-dashboard-page')).toBeVisible()

    // Navigate to Club Members page
    await page.getByTestId('dashboard-members-btn').click()
    await expect(page.getByTestId('members-page-heading')).toBeVisible()

    // 4. Verify members table renders Bob as Club Member with "Make Admin" button
    const memberRow = page.getByTestId(`member-row-${memberId}`)
    await expect(memberRow).toBeVisible()
    await expect(page.getByTestId(`member-role-${memberId}`)).toHaveText(/Club Member|Clublid/i)

    const promoteBtn = page.getByTestId(`promote-member-${memberId}`)
    await expect(promoteBtn).toBeVisible()
    await expect(promoteBtn).toHaveText(/Make Admin|Beheerder maken/i)

    // 5. Admin clicks "Make Admin"
    await promoteBtn.click()

    // Success feedback is displayed
    const successAlert = page.getByTestId('promote-success-alert')
    await expect(successAlert).toBeVisible()

    // Member role updates to "Club Admin" in the table
    await expect(page.getByTestId(`member-role-${memberId}`)).toHaveText(/Club Admin|Clubbeheerder/i)
    // Promote button disappears
    await expect(page.getByTestId(`promote-member-${memberId}`)).not.toBeVisible()

    // 6. Log out admin
    await page.getByTestId('dashboard-logout-btn').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Create your account|Log in/)

    // 7. Promoted member logs in
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', memberEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await expect(page.getByTestId('club-dashboard-page')).toBeVisible()

    // 8. Verify promoted member now has Club Admin role, sees the invite code, and can access members
    await expect(page.getByTestId('dashboard-role-badge')).toHaveText(/Club Admin|Clubbeheerder/i)
    await expect(page.getByTestId('dashboard-invite-code-section')).toBeVisible()
    await expect(page.getByTestId('dashboard-members-btn')).toBeVisible()
  })
})
