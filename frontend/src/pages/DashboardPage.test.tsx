import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage, { type DashboardPageProps } from './DashboardPage'
import * as api from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getMemberClubs: vi.fn(),
    getClubDetails: vi.fn(),
  }
})

function renderDashboardPage(props: DashboardPageProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage {...props} />
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  const dummyMember = {
    memberId: 'mem-100',
    email: 'admin@example.com',
    token: 'valid-test-token',
  }

  const dummyClubAdmin: api.ClubDto = {
    id: 'club-alpha',
    name: 'Leuven Robotics Club',
    description: 'Hardware, drones, and autonomous systems.',
    role: 'Club Admin',
    inviteCode: '048291',
  }

  const dummyClubMember: api.ClubDto = {
    id: 'club-beta',
    name: 'Leuven Chess Guild',
    description: 'Weekly tournaments and blitz.',
    role: 'Club Member',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getMemberClubs).mockResolvedValue([dummyClubAdmin, dummyClubMember])
    vi.mocked(api.getClubDetails).mockResolvedValue(dummyClubAdmin)
  })

  it('renders club overview and module placeholders for Club Admin', async () => {
    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: vi.fn(),
      initialClubs: [dummyClubAdmin, dummyClubMember],
      initialActiveClubId: 'club-alpha',
    })

    expect(await screen.findByTestId('dashboard-club-name')).toHaveTextContent('Leuven Robotics Club')
    expect(screen.getByTestId('dashboard-role-badge')).toHaveTextContent(/Club Admin|Clubbeheerder/i)
    expect(screen.getByTestId('dashboard-club-description')).toHaveTextContent('Hardware, drones, and autonomous systems.')

    // Invite code section is visible for Club Admin
    expect(screen.getByTestId('dashboard-invite-code-section')).toBeInTheDocument()
    expect(screen.getByText(/048291/)).toBeInTheDocument()

    // 3 module placeholder cards are rendered
    expect(screen.getByText(/Calendar & Events|Kalender & Evenementen/i)).toBeInTheDocument()
    expect(screen.getByText(/Kanban Task Board|Kanban-takenbord/i)).toBeInTheDocument()
    expect(screen.getByText(/Logistics & Inventory|Logistiek & Voorraad/i)).toBeInTheDocument()
  })

  it('copies invite code when clicking copy button', async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: vi.fn(),
      initialClubs: [dummyClubAdmin],
      initialActiveClubId: 'club-alpha',
    })

    const copyBtn = await screen.findByTestId('dashboard-copy-invite-code')
    await user.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('048291')
    await waitFor(() => {
      expect(screen.getByText(/Copied!|Gekopieerd!/i)).toBeInTheDocument()
    })
  })

  it('does not display invite code section for Club Member', async () => {
    vi.mocked(api.getClubDetails).mockResolvedValue(dummyClubMember)

    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: vi.fn(),
      initialClubs: [dummyClubMember],
      initialActiveClubId: 'club-beta',
    })

    expect(await screen.findByTestId('dashboard-club-name')).toHaveTextContent('Leuven Chess Guild')
    expect(screen.getByTestId('dashboard-role-badge')).toHaveTextContent(/Club Member|Clublid/i)
    expect(screen.queryByTestId('dashboard-invite-code-section')).not.toBeInTheDocument()
  })

  it('calls onNavigateToLobby when clicking Back to Lobby button', async () => {
    const user = userEvent.setup()
    const handleNavigate = vi.fn()

    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: handleNavigate,
      initialClubs: [dummyClubAdmin],
      initialActiveClubId: 'club-alpha',
    })

    const backBtn = await screen.findByTestId('back-to-lobby-btn')
    await user.click(backBtn)

    expect(handleNavigate).toHaveBeenCalledTimes(1)
  })

  it('calls onLogout when clicking Log out button', async () => {
    const user = userEvent.setup()
    const handleLogout = vi.fn()

    renderDashboardPage({
      member: dummyMember,
      onLogout: handleLogout,
      onNavigateToLobby: vi.fn(),
      initialClubs: [dummyClubAdmin],
      initialActiveClubId: 'club-alpha',
    })

    const logoutBtn = await screen.findByTestId('dashboard-logout-btn')
    await user.click(logoutBtn)

    expect(handleLogout).toHaveBeenCalledTimes(1)
  })

  it('toggles language when clicking language toggle button', async () => {
    const user = userEvent.setup()

    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: vi.fn(),
      initialClubs: [dummyClubAdmin],
      initialActiveClubId: 'club-alpha',
    })

    const langBtn = await screen.findByTestId('dashboard-language-toggle')
    await user.click(langBtn)

    // Language switched
    expect(screen.getByTestId('dashboard-language-toggle')).toBeInTheDocument()
  })

  it('renders Access Denied view when API returns 403 Forbidden', async () => {
    const forbiddenError = new Error('Failed to fetch club details (403)') as Error & { status: number }
    forbiddenError.status = 403
    vi.mocked(api.getClubDetails).mockRejectedValue(forbiddenError)

    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: vi.fn(),
      initialClubs: [],
      initialActiveClubId: 'club-forbidden',
    })

    expect(await screen.findByTestId('dashboard-access-denied')).toBeInTheDocument()
    expect(screen.getAllByText(/Access Denied|Toegang geweigerd/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('back-to-lobby-btn').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSessionExpired when API returns 401 Unauthorized', async () => {
    const handleExpired = vi.fn()
    const unauthError = new Error('Failed to fetch club details (401)') as Error & { status: number }
    unauthError.status = 401
    vi.mocked(api.getClubDetails).mockRejectedValue(unauthError)

    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: vi.fn(),
      onSessionExpired: handleExpired,
      initialClubs: [dummyClubAdmin],
      initialActiveClubId: 'club-alpha',
    })

    await waitFor(() => {
      expect(handleExpired).toHaveBeenCalled()
    })
  })
  it('switches active club via dropdown in dashboard and updates hash', async () => {
    const user = userEvent.setup()
    window.location.hash = '#dashboard/club-alpha'

    renderDashboardPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onNavigateToLobby: vi.fn(),
      initialClubs: [dummyClubAdmin, dummyClubMember],
      initialActiveClubId: 'club-alpha',
    })

    const switcherBtn = await screen.findByRole('button', { name: /Switch club/i })
    await user.click(switcherBtn)

    const optionBeta = screen.getByRole('option', { name: /Leuven Chess Guild/i })
    await user.click(optionBeta)

    expect(window.location.hash).toBe('#dashboard/club-beta')
  })
})
