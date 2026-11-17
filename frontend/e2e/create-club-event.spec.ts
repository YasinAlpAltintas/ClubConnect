import { test, expect } from '@playwright/test'

test.describe('INC-24: Schedule Club Activities ("New Event" Form for Club Admin)', () => {
  test('direct API contract verification for POST /api/clubs/:id/events', async ({ request }) => {
    // 1. Unauthenticated request returns 401
    const unauthRes = await request.post('/api/clubs/00000000-0000-0000-0000-000000000000/events', {
      data: {
        title: 'Unauthorized Event',
        startTimeUtc: new Date().toISOString(),
        endTimeUtc: new Date(Date.now() + 3600000).toISOString(),
      },
    })
    expect(unauthRes.status()).toBe(401)

    // 2. Register Admin, Ordinary Member, and Stranger
    const adminEmail = `admin-event-${Date.now()}@example.com`
    const memberEmail = `member-event-${Date.now()}@example.com`
    const strangerEmail = `stranger-event-${Date.now()}@example.com`
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

    // 3. Admin creates club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Competitive Coding Club', description: 'Weekly algorithms and hackathons' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 4. Member joins club
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    const now = new Date()
    const validStart = new Date(now.getTime() + 86400000).toISOString()
    const validEnd = new Date(now.getTime() + 93600000).toISOString()

    // 5. Ordinary member attempts to create event -> 403 Forbidden
    const memberCreateRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: {
        title: 'Unauthorized Member Meetup',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(memberCreateRes.status()).toBe(403)

    // 6. Stranger attempts to create event -> 403 Forbidden
    const strangerCreateRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: {
        title: 'Stranger Meetup',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(strangerCreateRes.status()).toBe(403)

    // 7. Admin sends invalid dates (end time before start time) -> 400 Bad Request
    const invalidDatesRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Time Warp Workshop',
        startTimeUtc: validEnd,
        endTimeUtc: validStart,
      },
    })
    expect(invalidDatesRes.status()).toBe(400)

    // 8. Admin sends empty title -> 400 Bad Request
    const emptyTitleRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: '   ',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(emptyTitleRes.status()).toBe(400)

    // 9. Admin sends valid payload -> 201 Created
    const validCreateRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Algorithm Sprint',
        description: 'Dynamic programming practice session.',
        location: 'Room 3.02',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(validCreateRes.status()).toBe(201)
    const createdEvent = await validCreateRes.json()
    expect(createdEvent.title).toBe('Algorithm Sprint')
    expect(createdEvent.location).toBe('Room 3.02')

    // 10. Verify event appears in GET /api/clubs/:id/events
    const getEventsRes = await request.get(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    expect(getEventsRes.status()).toBe(200)
    const eventsList = await getEventsRes.json()
    expect(eventsList.some((e: { title: string }) => e.title === 'Algorithm Sprint')).toBe(true)
  })

  test('Club Admin schedules event via calendar UI and event badge appears on grid; ordinary member cannot create', async ({
    page,
    request,
  }) => {
    const adminEmail = `e2e-admin-event-${Date.now()}@example.com`
    const memberEmail = `e2e-member-event-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Setup accounts via API
    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken } = await loginMemberRes.json()

    // 2. Create club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'E2E Event Schedule Club', description: 'Testing INC-24 event scheduling' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 3. Member joins club
    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })

    // 4. Log in as Club Admin
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', adminEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 5. Navigate from Lobby to Club Dashboard
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()

    // 6. Navigate to Calendar view
    await page.getByTestId('dashboard-calendar-btn').click()
    await expect(page).toHaveURL(new RegExp(`.*#dashboard/${club.id}/calendar`))

    // 7. Verify Club Admin sees "+ New Event" button
    const newEventBtn = page.getByTestId('calendar-new-event-btn')
    await expect(newEventBtn).toBeVisible()

    // 8. Open modal via "+ New Event" button and test cancel
    await newEventBtn.click()
    await expect(page.getByTestId('new-event-modal')).toBeVisible()
    await page.getByTestId('new-event-cancel-btn').click()
    await expect(page.getByTestId('new-event-modal')).not.toBeVisible()

    // 9. Open modal by clicking a calendar day cell
    // Get the first current-month day cell
    const today = new Date()
    const targetDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`
    const dayCell = page.getByTestId(`calendar-day-${targetDateStr}`)
    await dayCell.click()

    await expect(page.getByTestId('new-event-modal')).toBeVisible()
    await page.fill('#new-event-title-input', 'Annual Robotics Showcase')
    await page.fill('#new-event-location-input', 'Auditorium North')
    await page.fill('#new-event-description-input', 'Showcase student robot builds and autonomous rovers.')

    // 10. Submit event creation
    await page.getByTestId('new-event-submit-btn').click()

    // 11. Verify modal closes and event badge appears on the calendar grid
    await expect(page.getByTestId('new-event-modal')).not.toBeVisible()
    const eventBadge = page.getByTestId('calendar-grid').getByText('Annual Robotics Showcase')
    await expect(eventBadge).toBeVisible()

    // 12. Click event badge to open details dialog
    await eventBadge.click()
    await expect(page.getByTestId('calendar-event-modal')).toBeVisible()
    await expect(page.getByTestId('calendar-modal-title')).toHaveText('Annual Robotics Showcase')
    await expect(page.getByTestId('calendar-modal-location')).toHaveText('Auditorium North')
    await page.getByTestId('calendar-modal-close-btn').click()
    await expect(page.getByTestId('calendar-event-modal')).not.toBeVisible()

    // 13. Log out Admin
    await page.getByTestId('dashboard-logout-btn').click()
    await expect(page.getByRole('button', { name: /Log in|Inloggen/ })).toBeVisible()

    // 14. Log in as Ordinary Member
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', memberEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 15. Enter Club Dashboard -> Calendar
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await page.getByTestId('dashboard-calendar-btn').click()

    // 16. Verify Member sees the event badge scheduled by Admin
    await expect(page.getByTestId('calendar-grid').getByText('Annual Robotics Showcase')).toBeVisible()

    // 17. Verify Member DOES NOT see "+ New Event" button
    await expect(page.getByTestId('calendar-new-event-btn')).not.toBeVisible()
  })
})
