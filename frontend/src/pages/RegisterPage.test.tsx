import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { RegisterApiException, type RegisterApiError } from '../lib/api'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    registerMember: vi.fn(),
  }
})

import { registerMember } from '../lib/api'

const mockedRegister = vi.mocked(registerMember)

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

function apiException(error: RegisterApiError): RegisterApiException {
  return new RegisterApiException(error)
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, email and password fields', () => {
    renderWithProviders()
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields and does not call the api', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const email = screen.getByLabelText('E-mail address')
    const password = screen.getByLabelText('Password')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => {
      expect(screen.getByText('This field is required.')).toBeInTheDocument()
    })
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('shows client-side password error for a short password', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'abc1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(
        screen.getByText('Password must be at least 8 characters long.'),
      ).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('shows client-side error for a password without letters', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), '12345678')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(
        screen.getByText('Password must contain at least one letter.'),
      ).toBeInTheDocument()
    })
    expect(mockedRegister).not.toHaveBeenCalled()
  })

  it('sends valid registration data and shows success panel', async () => {
    const user = userEvent.setup()
    mockedRegister.mockResolvedValueOnce({
      memberId: 'member-1',
      email: 'user@example.com',
    })
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const heading = await screen.findByText('Account created')
    expect(heading).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByText('Welcome to ClubConnect, user@example.com. Your account is ready.'),
      ).toBeInTheDocument()
    })
    expect(mockedRegister).toHaveBeenCalledTimes(1)
    expect(mockedRegister).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'abcd1234',
    })
  })

  it('shows conflict error for 409', async () => {
    const user = userEvent.setup()
    mockedRegister.mockRejectedValueOnce(apiException({ code: 'conflict' }))
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('An account with this e-mail already exists.')
    expect(screen.queryByText('Account created')).not.toBeInTheDocument()
  })

  it('marks email invalid for 400 with e-mail detail', async () => {
    const user = userEvent.setup()
    mockedRegister.mockRejectedValueOnce(
      apiException({ code: 'validation', message: 'email is invalid' }),
    )
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Enter a valid e-mail address.')
    expect(screen.getByLabelText('E-mail address')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'false')
  })

  it('marks password invalid for 400 with password detail', async () => {
    const user = userEvent.setup()
    mockedRegister.mockRejectedValueOnce(
      apiException({ code: 'validation', message: 'Password must be stronger' }),
    )
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Check your password and try again.')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows network error when the request fails', async () => {
    const user = userEvent.setup()
    mockedRegister.mockRejectedValueOnce(apiException({ code: 'network' }))
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Something went wrong. Please try again.')
  })

  it('shows unexpected error with status for 503', async () => {
    const user = userEvent.setup()
    mockedRegister.mockRejectedValueOnce(apiException({ code: 'unexpected', status: 503 }))
    renderWithProviders()

    await user.type(screen.getByLabelText('E-mail address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Unexpected response (503).')
  })

  it('switches to Dutch and renders translated strings', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    await user.click(screen.getByRole('button', { name: 'Nederlands' }))

    expect(await screen.findByRole('heading', { name: 'Maak een account aan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account aanmaken' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
  })

  it('shows validation error immediately when tabbing out of an invalid email', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    const emailInput = screen.getByLabelText('E-mail address')
    await user.type(emailInput, 'invalid-email')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Enter a valid e-mail address.')).toBeInTheDocument()
    })
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    expect(emailInput.className).toContain('border-red-500')
  })

  it('shows validation error immediately when tabbing out of a short password', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    const passwordInput = screen.getByLabelText('Password')
    await user.type(passwordInput, 'abc')
    await user.tab()

    await waitFor(() => {
      expect(
        screen.getByText('Password must be at least 8 characters long.'),
      ).toBeInTheDocument()
    })
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput.className).toContain('border-red-500')
  })
})
