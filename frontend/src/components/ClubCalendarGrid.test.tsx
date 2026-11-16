import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import ClubCalendarGrid from './ClubCalendarGrid'
import { type ClubEventDto } from '../lib/api'
import '../i18n'

describe('ClubCalendarGrid', () => {
  const fixedDate = new Date(2026, 10, 15) // November 15, 2026 (Month is 0-indexed: 10 = Nov)

  const sampleEvents: ClubEventDto[] = [
    {
      id: 'evt-1',
      clubId: 'club-123',
      title: 'Robotics Workshop',
      description: 'Hands-on Arduino workshop for freshmen.',
      location: 'Science Lab 4B',
      startTimeUtc: '2026-11-18T14:00:00Z',
      endTimeUtc: '2026-11-18T16:00:00Z',
      createdByMemberId: 'mem-admin',
      createdAtUtc: '2026-11-01T10:00:00Z',
    },
    {
      id: 'evt-2',
      clubId: 'club-123',
      title: 'Board Games Night',
      description: 'Casual board games and pizza.',
      location: 'Campus Lounge',
      startTimeUtc: '2026-11-25T18:00:00Z',
      endTimeUtc: '2026-11-25T21:00:00Z',
      createdByMemberId: 'mem-admin',
      createdAtUtc: '2026-11-02T11:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders calendar section, month heading, weekday headers, and 35 or 42 day cells', () => {
    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
      />
    )

    expect(screen.getByTestId('club-calendar-section')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent(/November 2026/i)
    expect(screen.getByTestId('calendar-event-count')).toHaveTextContent(/2 events this month/i)

    // Weekdays
    expect(screen.getByTestId('calendar-weekday-0')).toHaveTextContent(/Mon/i)
    expect(screen.getByTestId('calendar-weekday-6')).toHaveTextContent(/Sun/i)

    // Calendar day cells
    expect(screen.getByTestId('calendar-day-2026-11-01')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-day-2026-11-18')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-day-2026-11-30')).toBeInTheDocument()
  })

  it('renders event pills on matching day cells', () => {
    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
      />
    )

    const event1Pill = screen.getByTestId('calendar-event-evt-1')
    expect(event1Pill).toBeInTheDocument()
    expect(event1Pill).toHaveTextContent(/Robotics Workshop/i)

    const event2Pill = screen.getByTestId('calendar-event-evt-2')
    expect(event2Pill).toBeInTheDocument()
    expect(event2Pill).toHaveTextContent(/Board Games Night/i)
  })

  it('navigates to next month and previous month', async () => {
    const user = userEvent.setup()

    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
      />
    )

    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent(/November 2026/i)

    // Next month -> December 2026
    await user.click(screen.getByTestId('calendar-next-btn'))
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent(/December 2026/i)

    // Prev month -> back to November 2026
    await user.click(screen.getByTestId('calendar-prev-btn'))
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent(/November 2026/i)
  })

  it('resets to current month when clicking today button', async () => {
    const user = userEvent.setup()

    // Start on October 2025
    render(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={new Date(2025, 9, 1)}
      />
    )

    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent(/October 2025/i)

    await user.click(screen.getByTestId('calendar-today-btn'))

    const today = new Date()
    const expectedMonthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    expect(screen.getByTestId('calendar-month-heading')).toHaveTextContent(new RegExp(expectedMonthName, 'i'))
  })

  it('opens event details modal when clicking event pill and closes it on click', async () => {
    const user = userEvent.setup()
    const onSelectEvent = vi.fn()

    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
        onSelectEvent={onSelectEvent}
      />
    )

    const eventPill = screen.getByTestId('calendar-event-evt-1')
    await user.click(eventPill)

    expect(onSelectEvent).toHaveBeenCalledWith(sampleEvents[0])
    expect(screen.getByTestId('calendar-event-modal')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-modal-title')).toHaveTextContent('Robotics Workshop')
    expect(screen.getByTestId('calendar-modal-location')).toHaveTextContent('Science Lab 4B')
    expect(screen.getByTestId('calendar-modal-description')).toHaveTextContent('Hands-on Arduino workshop for freshmen.')

    // Close modal
    await user.click(screen.getByTestId('calendar-modal-close-btn'))
    expect(screen.queryByTestId('calendar-event-modal')).not.toBeInTheDocument()
  })

  it('renders loading state when isLoading is true', () => {
    render(
      <ClubCalendarGrid
        events={[]}
        isLoading={true}
        clubName="Robotics Club"
        initialDate={fixedDate}
      />
    )

    expect(screen.getByTestId('calendar-loading-spinner')).toBeInTheDocument()
  })

  it('renders error state and calls onRetry when retry button clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(
      <ClubCalendarGrid
        events={[]}
        isError={true}
        errorMessage="Network failure"
        onRetry={onRetry}
        clubName="Robotics Club"
        initialDate={fixedDate}
      />
    )

    expect(screen.getByTestId('calendar-error-banner')).toBeInTheDocument()
    expect(screen.getByText(/Network failure/i)).toBeInTheDocument()

    await user.click(screen.getByTestId('calendar-retry-btn'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders empty month state message when there are no events in current month', () => {
    render(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={fixedDate}
      />
    )

    expect(screen.getByTestId('calendar-empty-notice')).toBeInTheDocument()
  })
})
