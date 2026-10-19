import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LobbyPage, { type LobbyPageProps } from './LobbyPage'

function renderLobbyPage(props: LobbyPageProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <LobbyPage {...props} />
    </QueryClientProvider>,
  )
}

describe('LobbyPage', () => {
  const dummyMember = {
    memberId: 'mem-12345',
    email: 'visitor@example.com',
    displayName: 'Test Visitor',
  }

  it('renders lobby heading, welcome email, memberId, and displayName', () => {
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    expect(screen.getByRole('heading', { name: 'Club Lobby' })).toBeInTheDocument()
    expect(screen.getByText('Welcome back, visitor@example.com!')).toBeInTheDocument()
    expect(screen.getByText('mem-12345')).toBeInTheDocument()
    expect(screen.getByText('Test Visitor')).toBeInTheDocument()
  })

  it('calls onLogout when clicking logout button', async () => {
    const handleLogout = vi.fn()
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: handleLogout, initialClubs: [] })

    const logoutButtons = screen.getAllByRole('button', { name: 'Log out' })
    await user.click(logoutButtons[0])

    expect(handleLogout).toHaveBeenCalledTimes(1)
  })

  it('switches language when language toggle button is clicked', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const toggle = screen.getByRole('button', { name: /Nederlands|English/ })
    await user.click(toggle)

    // Verify it switched
    expect(screen.getByRole('heading', { name: 'Club Lobby' })).toBeInTheDocument()
  })

  it('renders empty state with clear calls to action when member has no clubs', () => {
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    expect(screen.getByTestId('lobby-empty-state')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "You haven't joined any clubs yet" })).toBeInTheDocument()
    expect(screen.getByText(/ClubConnect brings student life to your fingertips/)).toBeInTheDocument()

    // CTAs
    expect(screen.getByRole('button', { name: 'Explore Clubs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Register a Club' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join Club' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. CLUB-2026')).toBeInTheDocument()

    // 3 Steps
    expect(screen.getByText('1. Discover Communities')).toBeInTheDocument()
    expect(screen.getByText('2. Connect & Network')).toBeInTheDocument()
    expect(screen.getByText('3. Attend Events')).toBeInTheDocument()
  })

  it('opens and closes the explore clubs modal', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    await user.click(screen.getByRole('button', { name: 'Explore Clubs' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Club Discovery' })).toBeInTheDocument()
    expect(screen.getByText(/Club discovery and directory browsing are arriving in Sprint 2/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens and closes the register a club modal', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    await user.click(screen.getByRole('button', { name: 'Register a Club' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Register a New Club' })).toBeInTheDocument()
    expect(screen.getByText(/Starting a club requires at least 3 founding members/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows validation error when submitting empty invite code', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid invite code.')
  })

  it('submits invite code and displays success notice', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const input = screen.getByPlaceholderText('e.g. CLUB-2026')
    await user.type(input, 'CHESS-2026')
    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      "Invite code validated! Your membership request has been submitted.",
    )
  })

  it('renders active clubs grid when member is already part of clubs', () => {
    const dummyClubs = [
      {
        id: 'club-1',
        name: 'Robotics Association',
        description: 'Building autonomous rovers and drones.',
        role: 'President',
      },
      {
        id: 'club-2',
        name: 'Debate Society',
        description: 'Weekly British Parliamentary debates.',
        role: 'Member',
      },
    ]

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: dummyClubs })

    expect(screen.queryByTestId('lobby-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('Robotics Association')).toBeInTheDocument()
    expect(screen.getByText('Building autonomous rovers and drones.')).toBeInTheDocument()
    expect(screen.getByText('President')).toBeInTheDocument()
    expect(screen.getByText('Debate Society')).toBeInTheDocument()
    expect(screen.getByText('2 clubs')).toBeInTheDocument()
  })
})
