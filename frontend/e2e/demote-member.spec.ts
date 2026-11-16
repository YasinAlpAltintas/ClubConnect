import { test, expect } from '@playwright/test'

test.describe('INC-19: Demote Club Admin to Club Member', () => {
  test('direct API contract verification: only Club Admin can demote another admin, self-demotion and sole admin demotion are blocked', async ({
    request,
  }) => {
    // 1. Unauthenticated PATCH returns 401
    const unauthRes = await request.patch(
      '/api/clubs/00000000-0000-0000-0000-000000000000/members/00000000-0000-0000-0000-000000000000/role',
      { data: { role: 'Club Member' } }
    )
    expect(unauthRes.status()).toBe(401)

    // 2. Register Admin 1, Member (future Admin 2), and Stranger
    const admin1Email = `inc19-admin1-api-${Date.now()}@example.com`
    const admin2Email = `inc19-admin2-api-${Date.now()}@example.com`
    const strangerEmail = `inc19-stranger-api-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: admin1Email, password } })
    const loginAdmin1Res = await request.post('/api/auth/login', { data: { email: admin1Email, password } })
    const { token: admin1Token, memberId: admin1Id } = await loginAdmin1Res.json()

    await request.post('/api/auth/register', { data: { email: admin2Email, password } })
    const loginAdmin2Res = await request.post('/api/auth/login', { data: { email: admin2Email, password } })
    const { token: admin2Token, memberId: admin2Id } = await loginAdmin2Res.json()

    await request.post('/api/auth/register', { data: { email: strangerEmail, password } })
    const loginStrangerRes = await request.post('/api/auth/login', { data: { email: strangerEmail, password } })
    const { token: strangerToken } = await loginStrangerRes.json()

    // 3. Admin 1 creates club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${admin1Token}` },
      data: { name: 'Leuven Artificial Intelligence Club', description: 'Machine learning collaborative' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 4. Member 2 joins club using invite code
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${admin2Token}` },
      data: { code: club.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 5. Admin 1 promotes Member 2 to Club Admin (now 2 admins exist)
    const promoteRes = await request.patch(`/api/clubs/${club.id}/members/${admin2Id}/role`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
      data: { role: 'Club Admin' },
    })
    expect(promoteRes.status()).toBe(200)

    // 6. Stranger tries to demote Admin 2 -> 403 Forbidden
    const strangerDemoteRes = await request.patch(`/api/clubs/${club.id}/members/${admin2Id}/role`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: { role: 'Club Member' },
    })
    expect(strangerDemoteRes.status()).toBe(403)

    // 7. Admin 1 tries to demote themselves -> 400 Bad Request
    const selfDemoteRes = await request.patch(`/api/clubs/${club.id}/members/${admin1Id}/role`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
      data: { role: 'Club Member' },
    })
    expect(selfDemoteRes.status()).toBe(400)

    // 8. Admin 1 successfully demotes Admin 2 back to Club Member -> 200 OK
    const demoteRes = await request.patch(`/api/clubs/${club.id}/members/${admin2Id}/role`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
      data: { role: 'Club Member' },
    })
    expect(demoteRes.status()).toBe(200)
    const demoted = await demoteRes.json()
    expect(demoted.role).toBe('Club Member')
    expect(demoted.memberId).toBe(admin2Id)

    // 9. Verify demoted member no longer receives invite code on GET /api/clubs/:id
    const demotedGetClubRes = await request.get(`/api/clubs/${club.id}`, {
      headers: { Authorization: `Bearer ${admin2Token}` },
    })
    expect(demotedGetClubRes.status()).toBe(200)
    const demotedClubDetails = await demotedGetClubRes.json()
    expect(demotedClubDetails.role).toBe('Club Member')
    expect(demotedClubDetails.inviteCode).toBeUndefined()

    // 10. Attempting to demote Admin 1 (now the only remaining admin) -> 400 Bad Request
    const soleAdminDemoteRes = await request.patch(`/api/clubs/${club.id}/members/${admin1Id}/role`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
      data: { role: 'Club Member' },
    })
    expect(soleAdminDemoteRes.status()).toBe(400)
  })

  test('Club Admin demotes another Club Admin in the UI with confirmation; demoted user loses admin privileges', async ({
    page,
    request,
  }) => {
    const admin1Email = `inc19-ui-admin1-${Date.now()}@example.com`
    const admin2Email = `inc19-ui-admin2-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Register admin 1 via API and create club
    await request.post('/api/auth/register', { data: { email: admin1Email, password } })
    const loginAdmin1Res = await request.post('/api/auth/login', { data: { email: admin1Email, password } })
    const { token: admin1Token } = await loginAdmin1Res.json()

    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${admin1Token}` },
      data: { name: 'Leuven Quantum Computing', description: 'Quantum hardware and simulation' },
    })
    const club = await clubRes.json()

    // 2. Register member 2 via API, join club, and promote to Club Admin
    await request.post('/api/auth/register', { data: { email: admin2Email, password } })
    const loginAdmin2Res = await request.post('/api/auth/login', { data: { email: admin2Email, password } })
    const { token: admin2Token, memberId: admin2Id } = await loginAdmin2Res.json()

    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${admin2Token}` },
      data: { code: club.inviteCode },
    })

    await request.patch(`/api/clubs/${club.id}/members/${admin2Id}/role`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
      data: { role: 'Club Admin' },
    })

    // 3. Admin 1 logs into the browser UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', admin1Email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // Navigate to Club Dashboard & Members page
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await expect(page.getByTestId('club-dashboard-page')).toBeVisible()

    await page.getByTestId('dashboard-members-btn').click()
    await expect(page.getByTestId('members-page-heading')).toBeVisible()

    // 4. Verify Admin 2 row has "Demote" button
    const admin2Row = page.getByTestId(`member-row-${admin2Id}`)
    await expect(admin2Row).toBeVisible()
    await expect(page.getByTestId(`member-role-${admin2Id}`)).toHaveText(/Club Admin|Clubbeheerder/i)

    const demoteBtn = page.getByTestId(`demote-member-${admin2Id}`)
    await expect(demoteBtn).toBeVisible()
    await expect(demoteBtn).toHaveText(/Demote|Degraderen/i)

    // 5. Click Demote -> Confirmation modal appears
    await demoteBtn.click()
    const modal = page.getByTestId('demote-member-modal')
    await expect(modal).toBeVisible()

    // 6. Click Cancel in modal -> modal dismisses and role is unchanged
    await page.getByTestId('cancel-demote-member-btn').click()
    await expect(modal).not.toBeVisible()
    await expect(page.getByTestId(`member-role-${admin2Id}`)).toHaveText(/Club Admin|Clubbeheerder/i)

    // 7. Click Demote again and confirm
    await demoteBtn.click()
    await expect(modal).toBeVisible()
    await page.getByTestId('confirm-demote-member-btn').click()

    // 8. Success alert appears and role updates to "Club Member"
    const successAlert = page.getByTestId('demote-success-alert')
    await expect(successAlert).toBeVisible()
    await expect(page.getByTestId(`member-role-${admin2Id}`)).toHaveText(/Club Member|Clublid/i)

    // "Make Admin" button is now visible again for this member
    await expect(page.getByTestId(`promote-member-${admin2Id}`)).toBeVisible()
    await expect(page.queryByTestId(`demote-member-${admin2Id}`)).not.toBeVisible()

    // 9. Admin 1 logs out
    await page.getByTestId('dashboard-logout-btn').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Create your account|Log in/)

    // 10. Demoted member logs into UI and verifies revoked admin privileges
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', admin2Email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await expect(page.getByTestId('club-dashboard-page')).toBeVisible()

    // Verify demoted member only sees Club Member role, no invite code, and no members management button
    await expect(page.getByTestId('dashboard-role-badge')).toHaveText(/Club Member|Clublid/i)
    await expect(page.queryByTestId('dashboard-invite-code-section')).not.toBeVisible()
    await expect(page.queryByTestId('dashboard-members-btn')).not.toBeVisible()
  })
})
