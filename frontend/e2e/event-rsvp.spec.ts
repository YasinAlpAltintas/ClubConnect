import { test, expect } from '@playwright/test'

test.describe('INC-26: Event RSVP ("I\'m Attending")', () => {
  test('direct API contract verification for POST /api/clubs/:id/events/:eventId/rsvp', async ({ request }) => {
    // 1. Setup accounts
    const adminEmail = `admin-rsvp-${Date.now()}@example.com`
    const memberEmail = `member-rsvp-${Date.now()}@example.com`
    const strangerEmail = `stranger-rsvp-${Date.now()}@example.com`
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

    // 2. Admin creates club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'E2E RSVP Club', description: 'Testing event RSVP flow' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 3. Member joins club
    const joinRes = await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })
    expect(joinRes.status()).toBe(200)

    const now = new Date()
    const validStart = new Date(now.getTime() + 86400000).toISOString()
    const validEnd = new Date(now.getTime() + 93600000).toISOString()

    // 4. Admin schedules event
    const createEventRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Community Hackathon Briefing',
        location: 'Innovation Lab',
        description: 'RSVP required for team placement.',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(createEventRes.status()).toBe(201)
    const event = await createEventRes.json()

    // 5. Unauthenticated POST -> 401 Unauthorized
    const unauthRes = await request.post(`/api/clubs/${club.id}/events/${event.id}/rsvp`, {
      data: { isAttending: true },
    })
    expect(unauthRes.status()).toBe(401)

    // 6. Non-member (stranger) POST -> 403 Forbidden
    const strangerRes = await request.post(`/api/clubs/${club.id}/events/${event.id}/rsvp`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: { isAttending: true },
    })
    expect(strangerRes.status()).toBe(403)

    // 7. Non-existent club -> 404 Not Found
    const nonExistentClubRes = await request.post(
      `/api/clubs/99999999-9999-9999-9999-999999999999/events/${event.id}/rsvp`,
      {
        headers: { Authorization: `Bearer ${memberToken}` },
        data: { isAttending: true },
      },
    )
    expect(nonExistentClubRes.status()).toBe(404)

    // 8. Non-existent event -> 404 Not Found
    const nonExistentEventRes = await request.post(
      `/api/clubs/${club.id}/events/99999999-9999-9999-9999-999999999999/rsvp`,
      {
        headers: { Authorization: `Bearer ${memberToken}` },
        data: { isAttending: true },
      },
    )
    expect(nonExistentEventRes.status()).toBe(404)

    // 9. Empty GUID -> 400 Bad Request
    const emptyGuidRes = await request.post(
      `/api/clubs/${club.id}/events/00000000-0000-0000-0000-000000000000/rsvp`,
      {
        headers: { Authorization: `Bearer ${memberToken}` },
        data: { isAttending: true },
      },
    )
    expect(emptyGuidRes.status()).toBe(400)

    // 10. Valid Member RSVP (isAttending: true) -> 200 OK
    const rsvpAttendRes = await request.post(`/api/clubs/${club.id}/events/${event.id}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { isAttending: true },
    })
    expect(rsvpAttendRes.status()).toBe(200)
    const attendedEvent = await rsvpAttendRes.json()
    expect(attendedEvent.id).toBe(event.id)
    expect(attendedEvent.isAttending).toBe(true)
    expect(attendedEvent.attendeeCount).toBe(1)
    expect(attendedEvent.attendees).toBeDefined()
    expect(attendedEvent.attendees.length).toBe(1)
    expect(attendedEvent.attendees[0].email).toBe(memberEmail)

    // Verify GET /api/clubs/:id/events reflects attendance
    const getEventsRes = await request.get(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    })
    expect(getEventsRes.status()).toBe(200)
    const eventsList = await getEventsRes.json()
    const listedEvent = eventsList.find((e: { id: string }) => e.id === event.id)
    expect(listedEvent).toBeDefined()
    expect(listedEvent.isAttending).toBe(true)
    expect(listedEvent.attendeeCount).toBe(1)

    // 11. Valid Member Cancel RSVP (isAttending: false) -> 200 OK
    const rsvpCancelRes = await request.post(`/api/clubs/${club.id}/events/${event.id}/rsvp`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { isAttending: false },
    })
    expect(rsvpCancelRes.status()).toBe(200)
    const cancelledEvent = await rsvpCancelRes.json()
    expect(cancelledEvent.id).toBe(event.id)
    expect(cancelledEvent.isAttending).toBe(false)
    expect(cancelledEvent.attendeeCount).toBe(0)
    expect(cancelledEvent.attendees.length).toBe(0)
  })

  test('Club Member clicks "I\'m Attending" in event details modal, sees attendee status update, and cancels RSVP', async ({
    page,
    request,
  }) => {
    const adminEmail = `admin-ui-rsvp-${Date.now()}@example.com`
    const memberEmail = `member-ui-rsvp-${Date.now()}@example.com`
    const password = 'Passw0rd123!'

    // 1. Setup accounts via API
    await request.post('/api/auth/register', { data: { email: adminEmail, password } })
    const loginAdminRes = await request.post('/api/auth/login', { data: { email: adminEmail, password } })
    const { token: adminToken } = await loginAdminRes.json()

    await request.post('/api/auth/register', { data: { email: memberEmail, password } })
    const loginMemberRes = await request.post('/api/auth/login', { data: { email: memberEmail, password } })
    const { token: memberToken } = await loginMemberRes.json()

    // 2. Admin creates club
    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: 'Full-Stack Robotics Guild', description: 'Hands-on robotics and microcontrollers' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 3. Member joins club
    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })

    // 4. Admin schedules event for tomorrow (within current month)
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 86400000)
    const validStart = tomorrow.toISOString()
    const validEnd = new Date(tomorrow.getTime() + 7200000).toISOString()

    const createEventRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Autonomous Drone Workshop',
        location: 'Robotics Hangar B',
        description: 'Hands-on drone navigation and sensor integration.',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(createEventRes.status()).toBe(201)

    // 5. Member logs in through UI
    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', memberEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 6. Enter Club Dashboard -> Calendar
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await page.getByTestId('dashboard-calendar-btn').click()
    await expect(page).toHaveURL(new RegExp(`.*#dashboard/${club.id}/calendar`))

    // 7. Locate event badge on calendar grid and click to open details modal
    const eventBadge = page.getByTestId('calendar-grid').getByText('Autonomous Drone Workshop')
    await expect(eventBadge).toBeVisible()
    await eventBadge.click()

    // 8. Verify modal displays initial non-attending state
    await expect(page.getByTestId('calendar-event-modal')).toBeVisible()
    await expect(page.getByTestId('calendar-modal-title')).toHaveText('Autonomous Drone Workshop')
    await expect(page.getByTestId('event-attendee-count-badge')).toBeVisible()
    await expect(page.getByTestId('event-attendee-count-badge')).toHaveText(/0/)
    await expect(page.getByTestId('event-user-attending-badge')).not.toBeVisible()

    const rsvpBtn = page.getByTestId('event-rsvp-btn')
    await expect(rsvpBtn).toBeVisible()
    await expect(rsvpBtn).toHaveText(/I'm Attending|Ik ben aanwezig/)

    // 9. Member clicks "I'm Attending" (RSVP)
    await rsvpBtn.click()

    // 10. Verify state updates to attending
    await expect(page.getByTestId('event-user-attending-badge')).toBeVisible()
    await expect(page.getByTestId('event-attendee-count-badge')).toHaveText(/1/)
    await expect(page.getByTestId('event-attendees-list')).toBeVisible()
    await expect(page.getByTestId('event-attendees-list')).toContainText(memberEmail)
    await expect(rsvpBtn).toHaveText(/Cancel RSVP|Afmelden/)

    // 11. Member cancels RSVP
    await rsvpBtn.click()

    // 12. Verify state reverts to not attending
    await expect(page.getByTestId('event-user-attending-badge')).not.toBeVisible()
    await expect(page.getByTestId('event-attendee-count-badge')).toHaveText(/0/)
    await expect(rsvpBtn).toHaveText(/I'm Attending|Ik ben aanwezig/)

    // 13. Close modal
    await page.getByTestId('calendar-modal-close-btn').click()
    await expect(page.getByTestId('calendar-event-modal')).not.toBeVisible()
  })
})
