import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  }
})

import { loginMember } from './lib/api'

const mockedLogin = vi.mocked(loginMember)

function renderApp(props?: { initialView?: 'register' | 'login' | 'lobby'; initialMember?: { memberId: string; email: string } }) {
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
    mockedLogin.mockResolvedValueOnce({
      memberId: 'mem-999',
      email: 'visitor@example.com',
      displayName: null,
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
    expect(window.location.hash).toBe('#login')
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
})
