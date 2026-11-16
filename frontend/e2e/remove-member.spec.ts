import { test, expect } from '@playwright/test'

test.describe('INC-18: Remove Club Member', () => {
  test('direct API contract verification: only Club Admin can remove members, self-removal is rejected, and revoked member loses access', async ({
    request,
  }) => {
    // 1. Unauthenticated DELETE returns 401
    const unauthRes = await request.delete(
      '/api/clubs/00000000-0000-0000-0000-000000000000/members/00000000-0000-0000-0000-000000000000'
    )
    expect(unauthRes.status()).toBe(401)

    // 2. Register Admin, Member, and Stranger
    const adminEmail = `inc18-admin-api-${Date.now()}@example.com`
    const memberEmail = `inc18-member-api-${Date.now()}@example.com`
    const strangerEmail = `inc18-stranger-api-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken, memberId: adminId } = await loginAdminRes.json()

    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken, memberId: targetMemberId } = await loginMemberRes.json()

    await request.post('/api/auth/register', { data: { email: strangerEmail, password } })
    const loginStrangerRes = await request.post('/api/auth/login', { data: { email: strangerEmail, password } })
    const { token: strangerToken } = await loginStrangerRes.json()

    // 3. Admin creates club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven Robotics Club', description: 'Autonomous robotics development' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 4. Member joins club using invite code
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 5. Member (non-admin) tries to remove someone -> 403 Forbidden
    const forbiddenRes = await request.delete(`/api/clubs/${club.id}/members/${adminId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    expect(forbiddenRes.status()).toBe(403)

    // 6. Stranger (not in club) tries to remove someone -> 403 Forbidden
    const strangerRes = await request.delete(`/api/clubs/${club.id}/members/${targetMemberId}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(strangerRes.status()).toBe(403)

    // 7. Admin tries to remove self -> 400 Bad Request
    const selfRemoveRes = await request.delete(`/api/clubs/${club.id}/members/${adminId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(selfRemoveRes.status()).toBe(400)

    // 8. Admin successfully removes Member -> 204 No Content
    const removeRes = await request.delete(`/api/clubs/${club.id}/members/${targetMemberId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(removeRes.status()).toBe(204)

    // 9. Verify removed member cannot access club details anymore -> 403 Forbidden
    const memberAccessRes = await request.get(`/api/clubs/${club.id}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    expect(memberAccessRes.status()).toBe(403)

    // 10. Verify member is removed from members list
    const membersListRes = await request.get(`/api/clubs/${club.id}/members`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(membersListRes.status()).toBe(200)
    const membersList = await membersListRes.json()
    expect(membersList.some((m: { memberId: string }) => m.memberId === targetMemberId)).toBe(false)

    // 11. Trying to remove member again returns 404 Not Found
    const repeatRemoveRes = await request.delete(`/api/clubs/${club.id}/members/${targetMemberId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(repeatRemoveRes.status()).toBe(404)
  })

  test('Club Admin removes a member through the UI after confirmation; member is removed and loses access', async ({
    page,
    request,
  }) => {
    const adminEmail = `inc18-ui-admin-${Date.now()}@example.com`
    const memberEmail = `inc18-ui-member-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Register admin via API and create club
    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Leuven Debate Society', description: 'Parliamentary debating club' },
    })
    const club = await clubRes.json()

    // 2. Register member via API and join club
    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken, memberId: targetMemberId } = await loginMemberRes.json()

    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })

    // 3. Admin logs into browser UI
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

    // 4. Verify member row exists with Remove button
    const memberRow = page.getByTestId(`member-row-${targetMemberId}`)
    await expect(memberRow).toBeVisible()

    const removeBtn = page.getByTestId(`remove-member-${targetMemberId}`)
    await expect(removeBtn).toBeVisible()
    await expect(removeBtn).toHaveText(/Remove|Verwijderen/i)

    // 5. Click Remove button to open confirmation modal
    await removeBtn.click()
    const modal = page.getByTestId('remove-member-modal')
    await expect(modal).toBeVisible()

    // 6. Click Cancel button in modal -> modal closes and member remains
    await page.getByTestId('cancel-remove-member-btn').click()
    await expect(modal).not.toBeVisible()
    await expect(memberRow).toBeVisible()

    // 7. Click Remove again and confirm
    await removeBtn.click()
    await expect(modal).toBeVisible()
    await page.getByTestId('confirm-remove-member-btn').click()

    // 8. Success alert appears and member is removed from the table
    const successAlert = page.getByTestId('remove-success-alert')
    await expect(successAlert).toBeVisible()
    await expect(page.getByTestId(`member-row-${targetMemberId}`)).not.toBeVisible()

    // 9. Admin logs out
    await page.getByTestId('dashboard-logout-btn').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Create your account|Log in/)

    // 10. Removed member logs in and verifies access has been revoked
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', memberEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Member should see empty lobby or not see the club
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await expect(page.getByTestId(`enter-dashboard-${club.id}`)).not.toBeVisible()
  })
})
