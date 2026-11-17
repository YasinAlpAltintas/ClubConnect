import { test, expect } from '@playwright/test'

test.describe('INC-25: Complete Event Details (Validation & Edit Event for Club Admin)', () => {
  test('direct API contract verification for PUT /api/clubs/:id/events/:eventId', async ({ request }) => {
    // 1. Setup accounts
    const adminEmail = `admin-edit-evt-${Date.now()}@example.com`
    const memberEmail = `member-edit-evt-${Date.now()}@example.com`
    const strangerEmail = `stranger-edit-evt-${Date.now()}@example.com`
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
      data: { name: 'Full Stack Developers Club', description: 'Web and backend craft' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    // 3. Member joins club
    await request.post('/api/clubs/join', {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { code: club.inviteCode },
    })

    const now = new Date()
    const validStart = new Date(now.getTime() + 86400000).toISOString()
    const validEnd = new Date(now.getTime() + 93600000).toISOString()

    // 4. Admin creates event
    const createEventRes = await request.post(`/api/clubs/${club.id}/events`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Initial Architecture Briefing',
        location: 'Room A-10',
        description: 'Initial system overview.',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(createEventRes.status()).toBe(201)
    const event = await createEventRes.json()

    // 5. Unauthenticated PUT -> 401
    const unauthRes = await request.put(`/api/clubs/${club.id}/events/${event.id}`, {
      data: {
        title: 'Unauthorized Edit',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(unauthRes.status()).toBe(401)

    // 6. Ordinary member attempts PUT -> 403 Forbidden
    const memberEditRes = await request.put(`/api/clubs/${club.id}/events/${event.id}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: {
        title: 'Member Attempted Edit',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(memberEditRes.status()).toBe(403)

    // 7. Stranger attempts PUT -> 403 Forbidden
    const strangerEditRes = await request.put(`/api/clubs/${club.id}/events/${event.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: {
        title: 'Stranger Attempted Edit',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(strangerEditRes.status()).toBe(403)

    // 8. Non-existent event ID -> 404 Not Found
    const notFoundEventRes = await request.put(`/api/clubs/${club.id}/events/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Ghost Event',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(notFoundEventRes.status()).toBe(404)

    // 9. Admin invalid dates (endTime <= startTime) -> 400 Bad Request
    const invalidDatesRes = await request.put(`/api/clubs/${club.id}/events/${event.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Invalid Date Range',
        startTimeUtc: validEnd,
        endTimeUtc: validStart,
      },
    })
    expect(invalidDatesRes.status()).toBe(400)

    // 10. Admin empty title -> 400 Bad Request
    const emptyTitleRes = await request.put(`/api/clubs/${club.id}/events/${event.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: '   ',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(emptyTitleRes.status()).toBe(400)

    // 11. Admin valid update -> 200 OK
    const updateRes = await request.put(`/api/clubs/${club.id}/events/${event.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Complete Architecture Deep Dive',
        location: 'Main Auditorium & Online Stream',
        description: 'Comprehensive walkthrough of event microservices architecture.',
        startTimeUtc: validStart,
        endTimeUtc: validEnd,
      },
    })
    expect(updateRes.status()).toBe(200)
    const updatedEvent = await updateRes.json()
    expect(updatedEvent.id).toBe(event.id)
    expect(updatedEvent.title).toBe('Complete Architecture Deep Dive')
    expect(updatedEvent.location).toBe('Main Auditorium & Online Stream')
    expect(updatedEvent.description).toBe('Comprehensive walkthrough of event microservices architecture.')
  })

  test('Club Admin views event details, edits event title, location, and description; changes persist and ordinary member sees updated read-only details', async ({
    page,
    request,
  }) => {
    const adminEmail = `e2e-admin-edit-${Date.now()}@example.com`
    const memberEmail = `e2e-member-edit-${Date.now()}@example.com`
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
      data: { name: 'E2E Event Edit Club', description: 'Testing INC-25 event editing' },
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

    // 5. Navigate to Club Dashboard -> Calendar
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await page.getByTestId('dashboard-calendar-btn').click()
    await expect(page).toHaveURL(new RegExp(`.*#dashboard/${club.id}/calendar`))

    // 6. Admin creates an event using day cell
    const today = new Date()
    const targetDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20`
    await page.getByTestId(`calendar-day-${targetDateStr}`).click()

    await expect(page.getByTestId('new-event-modal')).toBeVisible()
    await page.fill('#new-event-title-input', 'Draft Event 1.0')
    await page.fill('#new-event-location-input', 'Room 101')
    await page.fill('#new-event-description-input', 'Draft description before review.')
    await page.getByTestId('new-event-submit-btn').click()
    await expect(page.getByTestId('new-event-modal')).not.toBeVisible()

    // 7. Verify event badge appears on grid
    const eventBadge = page.getByTestId('calendar-grid').getByText('Draft Event 1.0')
    await expect(eventBadge).toBeVisible()

    // 8. Open details modal
    await eventBadge.click()
    await expect(page.getByTestId('calendar-event-modal')).toBeVisible()
    await expect(page.getByTestId('calendar-modal-title')).toHaveText('Draft Event 1.0')
    await expect(page.getByTestId('calendar-modal-location')).toHaveText('Room 101')
    await expect(page.getByTestId('calendar-modal-description')).toHaveText('Draft description before review.')

    // 9. Admin clicks Edit Event button
    const editBtn = page.getByTestId('calendar-modal-edit-btn')
    await expect(editBtn).toBeVisible()
    await editBtn.click()

    // 10. Edit form is visible and pre-filled
    await expect(page.getByTestId('edit-event-form')).toBeVisible()
    await expect(page.getByTestId('edit-event-title-input')).toHaveValue('Draft Event 1.0')
    await expect(page.getByTestId('edit-event-location-input')).toHaveValue('Room 101')
    await expect(page.getByTestId('edit-event-description-input')).toHaveValue('Draft description before review.')

    // 11. Test Cancel button reverts cleanly
    await page.getByTestId('edit-event-cancel-btn').click()
    await expect(page.getByTestId('edit-event-form')).not.toBeVisible()
    await expect(page.getByTestId('calendar-modal-title')).toHaveText('Draft Event 1.0')

    // 12. Re-open Edit and update details
    await page.getByTestId('calendar-modal-edit-btn').click()
    await page.fill('#edit-event-title-input', 'Finalized Showcase 2.0')
    await page.fill('#edit-event-location-input', 'Campus Amphitheater')
    await page.fill('#edit-event-description-input', 'Complete project exhibition with external industry judges.')

    // 13. Submit edit form
    await page.getByTestId('edit-event-submit-btn').click()

    // 14. Verify modal closes, success notice appears, and grid reflects updated title
    await expect(page.getByTestId('calendar-event-modal')).not.toBeVisible()
    await expect(page.getByTestId('calendar-success-banner')).toBeVisible()
    await expect(page.getByTestId('calendar-success-banner')).toHaveText(/Finalized Showcase 2.0/)

    const updatedEventBadge = page.getByTestId('calendar-grid').getByText('Finalized Showcase 2.0')
    await expect(updatedEventBadge).toBeVisible()

    // 15. Click updated badge to verify all updated details in modal
    await updatedEventBadge.click()
    await expect(page.getByTestId('calendar-event-modal')).toBeVisible()
    await expect(page.getByTestId('calendar-modal-title')).toHaveText('Finalized Showcase 2.0')
    await expect(page.getByTestId('calendar-modal-location')).toHaveText('Campus Amphitheater')
    await expect(page.getByTestId('calendar-modal-description')).toHaveText('Complete project exhibition with external industry judges.')
    await page.getByTestId('calendar-modal-close-btn').click()
    await expect(page.getByTestId('calendar-event-modal')).not.toBeVisible()

    // 16. Log out Admin
    await page.getByTestId('dashboard-logout-btn').click()
    await expect(page.getByRole('button', { name: /Log in|Inloggen/ })).toBeVisible()

    // 17. Log in as Ordinary Member
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', memberEmail)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    // 18. Enter Club Dashboard -> Calendar
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()
    await page.getByTestId('dashboard-calendar-btn').click()

    // 19. Ordinary Member sees updated event on grid
    const memberViewEventBadge = page.getByTestId('calendar-grid').getByText('Finalized Showcase 2.0')
    await expect(memberViewEventBadge).toBeVisible()

    // 20. Member clicks event pill: details are complete, but no Edit button is visible
    await memberViewEventBadge.click()
    await expect(page.getByTestId('calendar-event-modal')).toBeVisible()
    await expect(page.getByTestId('calendar-modal-title')).toHaveText('Finalized Showcase 2.0')
    await expect(page.getByTestId('calendar-modal-location')).toHaveText('Campus Amphitheater')
    await expect(page.getByTestId('calendar-modal-description')).toHaveText('Complete project exhibition with external industry judges.')
    await expect(page.getByTestId('calendar-modal-edit-btn')).not.toBeVisible()
  })
})
