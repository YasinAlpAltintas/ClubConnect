import { test, expect } from '@playwright/test'

// INC-27: Kanban board with To Do / In Progress / Done columns.
// Task creation arrives in INC-37, so these flows cover the board on a club without tasks,
// plus the API's tenant isolation. Grouping and card contents are covered by component tests.
test.describe('INC-27: Kanban Task Board', () => {
  const password = 'Passw0rd123!'

  async function registerAndLogin(request: import('@playwright/test').APIRequestContext, prefix: string) {
    const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
    await request.post('/api/auth/register', { data: { email, password } })
    const loginRes = await request.post('/api/auth/login', { data: { email, password } })
    const { token } = await loginRes.json()
    return { email, token: token as string }
  }

  test('API: rejects unauthenticated and cross-club access to tasks (TC-27-09)', async ({ request }) => {
    const unauthRes = await request.get('/api/clubs/00000000-0000-0000-0000-000000000000/tasks')
    expect(unauthRes.status()).toBe(401)

    const adminA = await registerAndLogin(request, 'kanban-admin-a')
    const adminB = await registerAndLogin(request, 'kanban-admin-b')

    const clubARes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${adminA.token}` },
      data: { name: 'Kanban Club A' },
    })
    expect(clubARes.status()).toBe(201)
    const clubA = await clubARes.json()

    // Own club: allowed, empty list.
    const ownRes = await request.get(`/api/clubs/${clubA.id}/tasks`, {
      headers: { Authorization: `Bearer ${adminA.token}` },
    })
    expect(ownRes.status()).toBe(200)
    expect(await ownRes.json()).toEqual([])

    // Other tenant: denied without data.
    const crossRes = await request.get(`/api/clubs/${clubA.id}/tasks`, {
      headers: { Authorization: `Bearer ${adminB.token}` },
    })
    expect(crossRes.status()).toBe(403)
    expect(await crossRes.text()).not.toContain('"title"')
  })

  test('UI: member opens the board and sees all three columns with an empty state (TC-27-01, TC-27-06)', async ({
    page,
    request,
  }) => {
    const user = await registerAndLogin(request, 'kanban-ui')

    const clubRes = await request.post('/api/clubs', {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { name: 'Kanban Empty Club' },
    })
    expect(clubRes.status()).toBe(201)
    const club = await clubRes.json()

    await page.goto('/')
    await page.getByRole('button', { name: /Log in|Inloggen/ }).click()
    await page.fill('#email', user.email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Club Lobby/)
    await page.getByTestId(`enter-dashboard-${club.id}`).click()

    await page.getByTestId('dashboard-tasks-btn').click()
    await expect(page).toHaveURL(new RegExp(`.*#dashboard/${club.id}/tasks`))

    await expect(page.getByTestId('tasks-page-heading')).toBeVisible()
    await expect(page.getByTestId('kanban-empty-board')).toBeVisible()

    const headings = page.getByTestId('kanban-board').getByRole('heading', { level: 3 })
    await expect(headings).toHaveText([/To Do|Te doen/, /In Progress|Bezig/, /Done|Klaar/])
    await expect(page.getByTestId('kanban-column-empty-todo')).toBeVisible()
    await expect(page.getByTestId('kanban-column-empty-in_progress')).toBeVisible()
    await expect(page.getByTestId('kanban-column-empty-done')).toBeVisible()

    // Back to the overview.
    await page.getByTestId('tasks-back-to-dashboard-link').click()
    await expect(page.getByTestId('dashboard-club-name')).toHaveText('Kanban Empty Club')
  })
})
