import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingNameModal from './OnboardingNameModal'
import * as api from '../lib/api'

vi.mock('../lib/api', () => ({
  updateMemberProfile: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'onboarding.title': 'Welcome to ClubConnect!',
        'onboarding.subtitle': 'Enter your first and last name to complete your profile.',
        'onboarding.firstName': 'First name',
        'onboarding.lastName': 'Last name',
        'onboarding.submit': 'Save and continue',
        'onboarding.submitting': 'Saving…',
        'onboarding.errors.firstNameRequired': 'First name is required.',
        'onboarding.errors.lastNameRequired': 'Last name is required.',
      }
      return dict[key] ?? key
    },
  }),
}))

describe('OnboardingNameModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <OnboardingNameModal isOpen={false} token="test-token" onProfileUpdated={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal with validation and submits updated name', async () => {
    const user = userEvent.setup()
    const handleUpdated = vi.fn()
    vi.mocked(api.updateMemberProfile).mockResolvedValue({
      memberId: 'm-1',
      email: 'user@example.com',
      displayName: 'Alex Jansen',
      token: 'new-token-123',
    })

    render(
      <OnboardingNameModal isOpen={true} token="test-token" onProfileUpdated={handleUpdated} />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome to ClubConnect!' })).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Save and continue' })

    // 1. Submit empty -> validation errors
    await user.click(submitBtn)
    expect(screen.getByText('First name is required.')).toBeInTheDocument()
    expect(screen.getByText('Last name is required.')).toBeInTheDocument()
    expect(api.updateMemberProfile).not.toHaveBeenCalled()

    // 2. Fill in first name and surname
    const firstInput = screen.getByLabelText('First name')
    const lastInput = screen.getByLabelText('Last name')
    await user.type(firstInput, 'Alex')
    await user.type(lastInput, 'Jansen')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(api.updateMemberProfile).toHaveBeenCalledWith('test-token', {
        firstName: 'Alex',
        lastName: 'Jansen',
      })
      expect(handleUpdated).toHaveBeenCalledWith('Alex Jansen', 'new-token-123')
    })
  })
})
