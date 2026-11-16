import { test, expect } from '@playwright/test'

test.describe('INC-23: View Monthly Calendar Grid', () => {
  test('direct API contract verification for GET /api/clubs/:id/events', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.get('/api/clubs/00000000-0000-0000-0000-000000000000/events')
    expect(unauthRes.status()).toBe(401)

    // 2. Register & login Admin A, Regular Member, and Stranger
    const adminEmail = `admin-cal-${Date.now()}@example.com`
    const memberEmail = `member-cal-${Date.now()}@example.com`
    const strangerEmail = `stranger-cal-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken } = await loginMemberRes.json()

    await request.post('/api/auth/register', { data: { email: strangerEmail, password } })
    const loginStrangerRes = await request.post('/api/auth/login', { data: { email: strangerEmail, password } })
    const { token: strangerToken } = await loginStrangerRes.json()

    // 3. Admin creates Club Alpha
    const clubAlphaRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Calendar Robotics Society', description: 'Monthly calendar testing club' },
    })
    expect(clubAlphaRes.status()).toBe(201)
    const clubAlpha = await clubAlphaRes.json()

    // 4. Member joins Club Alpha
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: clubAlpha.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    // 5. Club Admin retrieves events -> 200 OK
    const adminGetEventsRes = await request.get(`/api/clubs/${clubAlpha.id}/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(adminGetEventsRes.status()).toBe(200)
    const adminEvents = await adminGetEventsRes.json()
    expect(Array.isArray(adminEvents)).toBe(true)

    // 6. Club Member retrieves events -> 200 OK (all club members can view calendar)
    const memberGetEventsRes = await request.get(`/api/clubs/${clubAlpha.id}/events`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    expect(memberGetEventsRes.status()).toBe(200)
    const memberEvents = await memberGetEventsRes.json()
    expect(Array.isArray(memberEvents)).toBe(true)

    // 7. Stranger (not in club) retrieves events -> 403 Forbidden (cross-tenant security isolation)
    const strangerGetEventsRes = await request.get(`/api/clubs/${clubAlpha.id}/events`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    })
    expect(strangerGetEventsRes.status()).toBe(403)

    // 8. Non-existent club -> 404 Not Found
    const notFoundRes = await request.get('/api/clubs/11111111-1111-1111-1111-111111111111/events', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(notFoundRes.status()).toBe(404)

    // 9. Invalid month -> 400 Bad Request
    const badMonthRes = await request.get(`/api/clubs/${clubAlpha.id}/events?year=2026&month=13`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(badMonthRes.status()).toBe(400)
  })

  test('user enters club dashboard, navigates to monthly calendar, explores month navigation and returns to overview', async ({
    page,
    request,
  }) => {
    const userEmail = `cal-user-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Create account & login via API
    await request.post('/api/auth/register', { data: { email: userEmail, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email: userEmail, password } })
    const { token } = await loginRes.json()

    // 2. Create club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Astronomy & Stargazing', description: 'Night sky observations and telescope workshops' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 3. Log in through UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', userEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 4. Enter club dashboard from Lobby
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()

    // 5. On Overview page, verify Club Header and Calendar module
    await expect(page.getByTestId('dashboard-club-name')).toHaveTextContent('Astronomy & Stargazing')
    await expect(page.getByTestId('dashboard-calendar-btn')).toBeVisible()

    // 6. Navigate to Calendar via Overview module button
    await page.getByTestId('dashboard-calendar-btn').click()
    await expect(page).toHaveURL(new RegExp(`.*#dashboard/${club.id}/calendar`))

    // 7. Verify Calendar Grid elements
    await expect(page.getByTestId('calendar-page-heading')).toBeVisible()
    await expect(page.getByTestId('club-calendar-section')).toBeVisible()
    await expect(page.getByTestId('calendar-month-heading')).toBeVisible()
    await expect(page.getByTestId('calendar-grid')).toBeVisible()
    await expect(page.getByTestId('calendar-weekday-0')).toBeVisible()
    await expect(page.getByTestId('calendar-weekday-6')).toBeVisible()

    // 8. Month navigation
    const initialMonth = await page.getByTestId('calendar-month-heading').textContent()
    await page.getByTestId('calendar-next-btn').click()
    const nextMonth = await page.getByTestId('calendar-month-heading').textContent()
    expect(nextMonth).not.toBe(initialMonth)

    await page.getByTestId('calendar-prev-btn').click()
    const backToInitialMonth = await page.getByTestId('calendar-month-heading').textContent()
    expect(backToInitialMonth).toBe(initialMonth)

    // 9. Click Today button
    await page.getByTestId('calendar-today-btn').click()
    await expect(page.getByTestId('calendar-month-heading')).toBeVisible()

    // 10. Return to Dashboard Overview via link
    await page.getByTestId('calendar-back-to-dashboard-link').click()
    await expect(page.getByTestId('dashboard-club-name')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`.*#dashboard/${club.id}`))

    // 11. Navigate to Calendar via top header nav button
    await page.getByTestId('dashboard-calendar-nav-btn').click()
    await expect(page.getByTestId('calendar-page-heading')).toBeVisible()

    // 12. Return to Dashboard Overview via header button
    await page.getByTestId('calendar-back-to-dashboard-btn').click()
    await expect(page.getByTestId('dashboard-club-name')).toBeVisible()
  })
})
