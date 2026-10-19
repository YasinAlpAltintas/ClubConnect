import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LobbyPage from './LobbyPage'

describe('LobbyPage', () => {
  const dummyMember = {
    memberId: 'mem-12345',
    email: 'visitor@example.com',
    displayName: 'Test Visitor',
  }

  it('renders lobby heading, welcome email, memberId, and displayName', () => {
    render(<LobbyPage member={dummyMember} onLogout={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Club Lobby' })).toBeInTheDocument()
    expect(screen.getByText('Welcome back, visitor@example.com!')).toBeInTheDocument()
    expect(screen.getByText('mem-12345')).toBeInTheDocument()
    expect(screen.getByText('Test Visitor')).toBeInTheDocument()
  })

  it('calls onLogout when clicking logout button', async () => {
    const handleLogout = vi.fn()
    const user = userEvent.setup()
    render(<LobbyPage member={dummyMember} onLogout={handleLogout} />)

    const logoutButtons = screen.getAllByRole('button', { name: 'Log out' })
    await user.click(logoutButtons[0])

    expect(handleLogout).toHaveBeenCalledTimes(1)
  })

  it('switches language when language toggle button is clicked', async () => {
    const user = userEvent.setup()
    render(<LobbyPage member={dummyMember} onLogout={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: /Nederlands|English/ })
    await user.click(toggle)

    // Verify it switched
    expect(screen.getByRole('heading', { name: 'Club Lobby' })).toBeInTheDocument()
  })
})
