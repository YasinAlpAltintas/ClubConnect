import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClubSwitcherDropdown from './ClubSwitcherDropdown'
import { type ClubDto } from '../lib/api'

// Mock translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'clubSwitcher.label': 'Switch club',
        'clubSwitcher.selectClub': 'Select a club',
        'clubSwitcher.roleAdmin': 'Club Admin',
        'clubSwitcher.roleMember': 'Club Member',
      }
      return translations[key] ?? key
    },
  }),
}))

describe('ClubSwitcherDropdown', () => {
  const sampleClubs: ClubDto[] = [
    { id: 'club-1', name: 'Leuven Coding Society', role: 'Club Admin' },
    { id: 'club-2', name: 'Campus Robotics', role: 'Club Member' },
    { id: 'club-3', name: 'Debate Society', role: 'Club Member' },
  ]

  it('renders nothing when clubs list is empty', () => {
    const { container } = render(
      <ClubSwitcherDropdown
        clubs={[]}
        activeClubId={null}
        onSelectClub={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a clean single-club indicator without a dropdown when user has only 1 club', () => {
    render(
      <ClubSwitcherDropdown
        clubs={[sampleClubs[0]]}
        activeClubId="club-1"
        onSelectClub={vi.fn()}
      />,
    )

    expect(screen.getByTestId('single-club-indicator')).toBeInTheDocument()
    expect(screen.getByText('Leuven Coding Society')).toBeInTheDocument()
    expect(screen.getByText('Club Admin')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Switch club/i })).not.toBeInTheDocument()
  })

  it('renders dropdown button with active club name and role for multiple clubs', () => {
    render(
      <ClubSwitcherDropdown
        clubs={sampleClubs}
        activeClubId="club-2"
        onSelectClub={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: /Switch club/i })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Campus Robotics')).toBeInTheDocument()
    expect(screen.getByText('Club Member')).toBeInTheDocument()
  })

  it('opens listbox when clicked and displays accessible clubs with selection indicators', async () => {
    const user = userEvent.setup()
    render(
      <ClubSwitcherDropdown
        clubs={sampleClubs}
        activeClubId="club-1"
        onSelectClub={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: /Switch club/i })
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', { name: /Select a club/i })
    expect(listbox).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)

    // Option 1 is selected
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
    expect(options[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('selects another club when clicked, calls onSelectClub, and closes dropdown', async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    render(
      <ClubSwitcherDropdown
        clubs={sampleClubs}
        activeClubId="club-1"
        onSelectClub={handleSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Switch club/i }))
    const options = screen.getAllByRole('option')

    await user.click(options[1]) // Click Campus Robotics
    expect(handleSelect).toHaveBeenCalledWith('club-2')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes dropdown when Escape is pressed and returns focus to trigger', async () => {
    const user = userEvent.setup()
    render(
      <ClubSwitcherDropdown
        clubs={sampleClubs}
        activeClubId="club-1"
        onSelectClub={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: /Switch club/i })
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('navigates options using ArrowDown and ArrowUp keys', async () => {
    const user = userEvent.setup()
    render(
      <ClubSwitcherDropdown
        clubs={sampleClubs}
        activeClubId="club-1"
        onSelectClub={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: /Switch club/i })
    await user.click(trigger)

    const listbox = screen.getByRole('listbox')
    const options = screen.getAllByRole('option')

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(options[1]).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(options[2]).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    expect(options[1]).toHaveFocus()
  })

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ClubSwitcherDropdown
          clubs={sampleClubs}
          activeClubId="club-1"
          onSelectClub={vi.fn()}
        />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /Switch club/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
