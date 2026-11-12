import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import InviteCodeCard from './InviteCodeCard'
import '../i18n'

describe('InviteCodeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 6-digit invite code in overview variant for Club Admin', () => {
    render(<InviteCodeCard code="048291" role="Club Admin" variant="overview" />)

    expect(screen.getByTestId('dashboard-invite-code-section')).toBeInTheDocument()
    expect(screen.getByText(/048291/)).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-copy-invite-code')).toBeInTheDocument()
  })

  it('renders nothing when role is Club Member', () => {
    const { container } = render(<InviteCodeCard code="048291" role="Club Member" variant="overview" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when code is empty', () => {
    const { container } = render(<InviteCodeCard code="" role="Club Admin" variant="overview" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders invite code panel in members variant with admin badge and description', () => {
    render(
      <InviteCodeCard
        code="951230"
        clubName="Leuven Robotics Club"
        role="Club Admin"
        variant="members"
      />
    )

    expect(screen.getByTestId('members-invite-code-card')).toBeInTheDocument()
    expect(screen.getByTestId('invite-code-value')).toHaveTextContent('951230')
    expect(screen.getByTestId('members-copy-invite-code')).toBeInTheDocument()
    expect(screen.getByText(/Leuven Robotics Club/)).toBeInTheDocument()
  })

  it('copies invite code to clipboard and displays copied feedback in members variant', async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    render(
      <InviteCodeCard
        code="123456"
        clubName="Coding Club"
        role="Club Admin"
        variant="members"
      />
    )

    const copyBtn = screen.getByTestId('members-copy-invite-code')
    await user.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('123456')
    await waitFor(() => {
      expect(screen.getByTestId('copy-feedback-message')).toBeInTheDocument()
    })
  })

  it('copies invite code in overview variant and updates button text to copied', async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    render(<InviteCodeCard code="654321" role="Club Admin" variant="overview" />)

    const copyBtn = screen.getByTestId('dashboard-copy-invite-code')
    await user.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('654321')
    await waitFor(() => {
      expect(screen.getByText(/Copied!|Gekopieerd!/i)).toBeInTheDocument()
    })
  })

  it('falls back to document.execCommand when navigator.clipboard is unavailable', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const execCommandMock = vi.fn().mockReturnValue(true)
    document.execCommand = execCommandMock

    render(
      <InviteCodeCard
        code="888999"
        role="Club Admin"
        variant="members"
      />
    )

    const copyBtn = screen.getByTestId('members-copy-invite-code')
    await user.click(copyBtn)

    expect(execCommandMock).toHaveBeenCalledWith('copy')
    await waitFor(() => {
      expect(screen.getByTestId('copy-feedback-message')).toBeInTheDocument()
    })
  })

  it('auto-resets copied feedback after timeout', async () => {
    vi.useFakeTimers()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    render(
      <InviteCodeCard
        code="777111"
        role="Club Admin"
        variant="members"
      />
    )

    const copyBtn = screen.getByTestId('members-copy-invite-code')
    copyBtn.click()

    // Fast-forward 3000ms
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByTestId('copy-feedback-message')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
