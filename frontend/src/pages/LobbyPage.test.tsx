import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LobbyPage, { type LobbyPageProps } from './LobbyPage'
import * as api from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    createClub: vi.fn(),
    joinClub: vi.fn(),
    getMemberClubs: vi.fn(),
  }
})

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
    token: 'valid-test-token',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getMemberClubs).mockResolvedValue([])
    vi.mocked(api.joinClub).mockResolvedValue({
      id: 'c-1',
      name: 'Leuven Coding Society',
      description: 'Campus developers',
      role: 'Club Member',
    })
  })

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
    expect(screen.getAllByRole('button', { name: /Create New Club/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Join Club' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. 048291')).toBeInTheDocument()

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

  it('opens create new club modal, validates input, and cancels cleanly', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const createButtons = screen.getAllByRole('button', { name: /Create New Club/i })
    await user.click(createButtons[0])

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Create New Club' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create Club' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Club name is required.')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('successfully creates a club and closes modal', async () => {
    const user = userEvent.setup()
    vi.mocked(api.createClub).mockResolvedValue({
      id: 'c-100',
      name: 'Leuven Coding Society',
      description: 'Campus developers',
      role: 'Club Admin',
    })

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const createButtons = screen.getAllByRole('button', { name: /Create New Club/i })
    await user.click(createButtons[0])

    await user.type(screen.getByLabelText(/Club Name/i), 'Leuven Coding Society')
    await user.type(screen.getByLabelText(/Description/i), 'Campus developers')
    await user.click(screen.getByRole('button', { name: 'Create Club' }))

    await waitFor(() => {
      expect(api.createClub).toHaveBeenCalledWith(
        { name: 'Leuven Coding Society', description: 'Campus developers' },
        'valid-test-token',
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('displays API error alert when club creation fails', async () => {
    const user = userEvent.setup()
    vi.mocked(api.createClub).mockRejectedValue(
      new api.CreateClubApiException({ code: 'validation', message: 'Club name already exists' }),
    )

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const createButtons = screen.getAllByRole('button', { name: /Create New Club/i })
    await user.click(createButtons[0])

    await user.type(screen.getByLabelText(/Club Name/i), 'Existing Club')
    await user.click(screen.getByRole('button', { name: 'Create Club' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Club name already exists')
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onSessionExpired when API returns 401 unauthorized', async () => {
    const user = userEvent.setup()
    const handleSessionExpired = vi.fn()
    vi.mocked(api.createClub).mockRejectedValue(
      new api.CreateClubApiException({ code: 'unauthorized' }),
    )

    renderLobbyPage({
      member: dummyMember,
      onLogout: vi.fn(),
      onSessionExpired: handleSessionExpired,
      initialClubs: [],
    })

    const createButtons = screen.getAllByRole('button', { name: /Create New Club/i })
    await user.click(createButtons[0])

    await user.type(screen.getByLabelText(/Club Name/i), 'New Club')
    await user.click(screen.getByRole('button', { name: 'Create Club' }))

    await waitFor(() => {
      expect(handleSessionExpired).toHaveBeenCalledTimes(1)
    })
  })

  it('shows validation error when submitting empty invite code in empty lobby', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Invite code is required.')
  })

  it('shows validation error when entering fewer than 6 digits in empty lobby', async () => {
    const user = userEvent.setup()
    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const input = screen.getByPlaceholderText('e.g. 048291')
    await user.type(input, '123')
    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Invite code must be exactly 6 digits.')
  })

  it('submits valid 6-digit invite code in empty lobby and displays success notice', async () => {
    const user = userEvent.setup()
    vi.mocked(api.joinClub).mockResolvedValue({
      id: 'c-1',
      name: 'Leuven Coding Society',
      description: 'Campus developers',
      role: 'Club Member',
    })

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const input = screen.getByPlaceholderText('e.g. 048291')
    await user.type(input, '048291')
    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    await waitFor(() => {
      expect(api.joinClub).toHaveBeenCalledWith({ code: '048291' }, 'valid-test-token')
      expect(screen.getByRole('status')).toHaveTextContent(
        'Successfully joined Leuven Coding Society as a Club Member!',
      )
    })
  })

  it('displays not found error when invite code does not exist', async () => {
    const user = userEvent.setup()
    vi.mocked(api.joinClub).mockRejectedValue(
      new api.JoinClubApiException({ code: 'notFound', message: 'Invalid or unknown invite code.' }),
    )

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const input = screen.getByPlaceholderText('e.g. 048291')
    await user.type(input, '999999')
    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid or unknown invite code.')
    })
  })

  it('displays already member error when joining a club twice', async () => {
    const user = userEvent.setup()
    vi.mocked(api.joinClub).mockRejectedValue(
      new api.JoinClubApiException({ code: 'alreadyMember', message: 'You are already a member of this club.' }),
    )

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const input = screen.getByPlaceholderText('e.g. 048291')
    await user.type(input, '123456')
    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('You are already a member of this club.')
    })
  })

  it('displays rate limit error when submitting too many times', async () => {
    const user = userEvent.setup()
    vi.mocked(api.joinClub).mockRejectedValue(
      new api.JoinClubApiException({ code: 'rateLimited' }),
    )

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: [] })

    const input = screen.getByPlaceholderText('e.g. 048291')
    await user.type(input, '123456')
    await user.click(screen.getByRole('button', { name: 'Join Club' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Too many join attempts. Please wait a minute before trying again.',
      )
    })
  })

  it('renders active clubs grid when member is already part of clubs and opens Join Club modal', async () => {
    const user = userEvent.setup()
    const dummyClubs = [
      {
        id: 'club-1',
        name: 'Robotics Association',
        description: 'Building autonomous rovers and drones.',
        role: 'Club Admin',
        inviteCode: '048291',
      },
      {
        id: 'club-2',
        name: 'Debate Society',
        description: 'Weekly British Parliamentary debates.',
        role: 'Club Member',
      },
    ]

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: dummyClubs })

    expect(screen.getByText('Robotics Association')).toBeInTheDocument()
    expect(screen.getByText('Debate Society')).toBeInTheDocument()
    expect(screen.getByText('Club Admin')).toBeInTheDocument()
    expect(screen.getByText('Club Member')).toBeInTheDocument()
    expect(screen.getByText('Invite Code: 048291')).toBeInTheDocument()

    // Header buttons
    const joinButton = screen.getByRole('button', { name: 'Join Club' })
    await user.click(joinButton)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Join a Club' })).toBeInTheDocument()

    // Submit valid code in modal
    const modalInput = within(dialog).getByLabelText(/Invite Code/i)
    await user.type(modalInput, '654321')
    await user.click(within(dialog).getByRole('button', { name: 'Join Club' }))

    await waitFor(() => {
      expect(api.joinClub).toHaveBeenCalledWith({ code: '654321' }, 'valid-test-token')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('copies invite code to clipboard when Club Admin clicks copy button', async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    const dummyClubs = [
      {
        id: 'club-1',
        name: 'Robotics Association',
        role: 'Club Admin',
        inviteCode: '048291',
      },
    ]

    renderLobbyPage({ member: dummyMember, onLogout: vi.fn(), initialClubs: dummyClubs })

    const copyBtn = screen.getByRole('button', { name: 'Copy code' })
    await user.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('048291')
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })
})
