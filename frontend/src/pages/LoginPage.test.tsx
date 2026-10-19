import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './LoginPage'
import { LoginApiException, type LoginApiError } from '../lib/api'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    loginMember: vi.fn(),
  }
})

import { loginMember } from '../lib/api'

const mockedLogin = vi.mocked(loginMember)

function renderLoginPage(props: {
  onLoginSuccess?: (member: { memberId: string; email: string; displayName?: string | null }) => void
  onNavigateToRegister?: () => void
  sessionExpired?: boolean
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const onLoginSuccess = props.onLoginSuccess ?? vi.fn()
  const onNavigateToRegister = props.onNavigateToRegister ?? vi.fn()

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <LoginPage
          onLoginSuccess={onLoginSuccess}
          onNavigateToRegister={onNavigateToRegister}
          sessionExpired={props.sessionExpired}
        />
      </QueryClientProvider>,
    ),
    onLoginSuccess,
    onNavigateToRegister,
  }
}

function loginException(error: LoginApiError): LoginApiException {
  return new LoginApiException(error)
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, email and password fields, submit button, and link to register', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields and does not call loginMember', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const email = screen.getByLabelText('E-mail address')
    const password = screen.getByLabelText('Password')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => {
      expect(screen.getAllByText('This field is required.')).toHaveLength(2)
    })
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('shows validation error for invalid email format on blur', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    const emailInput = screen.getByLabelText('E-mail address')
    await user.type(emailInput, 'not-an-email')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Enter a valid e-mail address.')).toBeInTheDocument()
    })
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('submits valid credentials and calls onLoginSuccess', async () => {
    const user = userEvent.setup()
    const onLoginSuccess = vi.fn()
    mockedLogin.mockResolvedValueOnce({
      memberId: 'm-123',
      email: 'visitor@example.com',
      displayName: null,
      token: 'mock.valid.token',
    })

    renderLoginPage({ onLoginSuccess })

    await user.type(screen.getByLabelText('E-mail address'), 'visitor@example.com')
    await user.type(screen.getByLabelText('Password'), 'ValidPassword123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith({
        email: 'visitor@example.com',
        password: 'ValidPassword123',
      })
      expect(onLoginSuccess).toHaveBeenCalledWith({
        memberId: 'm-123',
        email: 'visitor@example.com',
        displayName: null,
        token: 'mock.valid.token',
      })
    })
  })

  it('shows generic invalid credentials error on 401', async () => {
    const user = userEvent.setup()
    mockedLogin.mockRejectedValueOnce(
      loginException({ code: 'invalid_credentials', message: 'Invalid email or password.' }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail address'), 'wrong@example.com')
    await user.type(screen.getByLabelText('Password'), 'WrongPassword1')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid e-mail address or password.')
  })

  it('shows validation error on 400', async () => {
    const user = userEvent.setup()
    mockedLogin.mockRejectedValueOnce(
      loginException({ code: 'validation', message: 'Email and password are required.' }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Please provide a valid e-mail address and password.')
  })

  it('shows network error when request fails', async () => {
    const user = userEvent.setup()
    mockedLogin.mockRejectedValueOnce(loginException({ code: 'network' }))

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('shows unexpected error on 500', async () => {
    const user = userEvent.setup()
    mockedLogin.mockRejectedValueOnce(
      loginException({ code: 'unexpected', status: 500 }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password1')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unexpected response (500).')
  })

  it('navigates to register when register link is clicked', async () => {
    const user = userEvent.setup()
    const onNavigateToRegister = vi.fn()

    renderLoginPage({ onNavigateToRegister })

    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(onNavigateToRegister).toHaveBeenCalledTimes(1)
  })

  it('switches language to Dutch and updates rendered strings', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    const toggle = screen.getByRole('button', { name: /Nederlands|English/ })
    await user.click(toggle)

    expect(await screen.findByRole('heading', { name: 'Inloggen op je account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inloggen' })).toBeInTheDocument()
  })

  it('displays session expired alert banner when sessionExpired is true', async () => {
    renderLoginPage({ sessionExpired: true })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Your session has expired. Please log in again.')
  })
})

