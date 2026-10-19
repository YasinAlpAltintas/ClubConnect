import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>()
  return {
    ...actual,
    loginMember: vi.fn(),
    registerMember: vi.fn(),
    checkEmailExists: vi.fn(),
    logoutMember: vi.fn(),
  }
})

import { loginMember, checkEmailExists, logoutMember } from './lib/api'

const mockedLogin = vi.mocked(loginMember)
const mockedCheckEmail = vi.mocked(checkEmailExists)
const mockedLogout = vi.mocked(logoutMember)

function renderApp(props?: { initialView?: 'register' | 'login' | 'lobby'; initialMember?: { memberId: string; email: string; token?: string } | null }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App {...props} />
    </QueryClientProvider>,
  )
}

describe('App navigation flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = ''
  })

  it('renders register view by default and navigates to login view', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

    const loginButton = screen.getByRole('button', { name: 'Log in' })
    await user.click(loginButton)

    expect(await screen.findByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#login')
  })

  it('navigates to login view when clicking inline Log in link on duplicate email', async () => {
    const user = userEvent.setup()
    mockedCheckEmail.mockResolvedValue(true)
    renderApp()

    const emailInput = screen.getByLabelText('E-mail address')
    await user.type(emailInput, 'existing@example.com')
    await user.tab()

    expect(await screen.findByText('An account with this e-mail already exists.')).toBeInTheDocument()

    const loginButtons = screen.getAllByRole('button', { name: 'Log in' })
    expect(loginButtons.length).toBe(2)
    // Click the inline login button (the first one, inside email error)
    await user.click(loginButtons[0])

    expect(await screen.findByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#login')
  })

  it('navigates from login view back to register view', async () => {
    const user = userEvent.setup()
    renderApp({ initialView: 'login' })

    expect(screen.getByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()

    const registerButton = screen.getByRole('button', { name: 'Create an account' })
    await user.click(registerButton)

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#register')
  })

  it('navigates to lobby on successful login and back to login on logout', async () => {
    const user = userEvent.setup()
    const header = btoa(JSON.stringify({ alg: 'HS256' })).replace(/=/g, '')
    const exp = Math.floor(Date.now() / 1000) + 3600
    const payload = btoa(JSON.stringify({ exp, sub: 'mem-999', email: 'visitor@example.com' })).replace(/=/g, '')
    const validFutureToken = `${header}.${payload}.sig`

    mockedLogin.mockResolvedValueOnce({
      memberId: 'mem-999',
      email: 'visitor@example.com',
      displayName: null,
      token: validFutureToken,
    })

    renderApp({ initialView: 'login' })

    await user.type(screen.getByLabelText('E-mail address'), 'visitor@example.com')
    await user.type(screen.getByLabelText('Password'), 'ValidPass123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Club Lobby' })).toBeInTheDocument()
    })
    expect(screen.getByText('Welcome back, visitor@example.com!')).toBeInTheDocument()
    expect(window.location.hash).toBe('#lobby')

    const logoutButtons = screen.getAllByRole('button', { name: 'Log out' })
    await user.click(logoutButtons[0])

    expect(await screen.findByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
    expect(mockedLogout).toHaveBeenCalledWith(validFutureToken)
    expect(window.location.hash).toBe('#login')
  })

  it('safely logs out when clicking card body logout button', async () => {
    const user = userEvent.setup()
    const header = btoa(JSON.stringify({ alg: 'HS256' })).replace(/=/g, '')
    const exp = Math.floor(Date.now() / 1000) + 3600
    const payload = btoa(JSON.stringify({ exp, sub: 'mem-999', email: 'visitor@example.com' })).replace(/=/g, '')
    const validFutureToken = `${header}.${payload}.sig`

    renderApp({
      initialView: 'lobby',
      initialMember: {
        memberId: 'mem-999',
        email: 'visitor@example.com',
        token: validFutureToken,
      },
    })

    expect(screen.getByRole('heading', { name: 'Club Lobby' })).toBeInTheDocument()

    const logoutButtons = screen.getAllByRole('button', { name: 'Log out' })
    expect(logoutButtons.length).toBe(2)
    // Click the card body logout button (second button)
    await user.click(logoutButtons[1])

    expect(await screen.findByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
    expect(mockedLogout).toHaveBeenCalledWith(validFutureToken)
    expect(window.location.hash).toBe('#login')
  })

  it('redirects unauthenticated visitor to login when initialView is lobby without member', () => {
    renderApp({ initialView: 'lobby', initialMember: null })
    expect(screen.getByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
  })

  it('responds to window hashchange events', async () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

    act(() => {
      window.location.hash = '#login'
      fireEvent(window, new HashChangeEvent('hashchange'))
    })

    expect(await screen.findByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()

    act(() => {
      window.location.hash = '#register'
      fireEvent(window, new HashChangeEvent('hashchange'))
    })

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('automatically redirects to login with session expired notice when JWT token expires', () => {
    vi.useFakeTimers()
    const now = 1000000000 * 1000
    vi.setSystemTime(new Date(now))

    // Token expires in 10 seconds
    const exp = 1000000000 + 10
    const header = btoa(JSON.stringify({ alg: 'HS256' })).replace(/=/g, '')
    const payload = btoa(JSON.stringify({ exp, sub: 'mem-1' })).replace(/=/g, '')
    const token = `${header}.${payload}.sig`

    renderApp({
      initialView: 'lobby',
      initialMember: {
        memberId: 'mem-1',
        email: 'user@example.com',
        token,
      },
    })

    expect(screen.getByRole('heading', { name: 'Club Lobby' })).toBeInTheDocument()

    // Advance timers past expiration
    act(() => {
      vi.advanceTimersByTime(11000)
    })

    expect(screen.getByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired. Please log in again.')
  })

  it('redirects to login immediately if token is already expired on mount', async () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' })).replace(/=/g, '')
    // Expired in 2000
    const payload = btoa(JSON.stringify({ exp: 1000, sub: 'mem-1' })).replace(/=/g, '')
    const token = `${header}.${payload}.sig`

    renderApp({
      initialView: 'lobby',
      initialMember: {
        memberId: 'mem-1',
        email: 'user@example.com',
        token,
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired. Please log in again.')
  })
})

