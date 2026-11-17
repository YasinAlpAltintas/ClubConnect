import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders "+ New Event" button only when isAdmin is true', () => {
    const { rerender } = render(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={false}
      />
    )

    expect(screen.queryByTestId('calendar-new-event-btn')).not.toBeInTheDocument()

    rerender(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
      />
    )

    expect(screen.getByTestId('calendar-new-event-btn')).toBeInTheDocument()
  })

  it('opens New Event modal when clicking "+ New Event" button and cancels cleanly', async () => {
    const user = userEvent.setup()

    render(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
        clubId="club-123"
        token="token-xyz"
      />
    )

    await user.click(screen.getByTestId('calendar-new-event-btn'))
    expect(screen.getByTestId('new-event-modal')).toBeInTheDocument()
    expect(screen.getByTestId('new-event-title-input')).toBeInTheDocument()

    await user.click(screen.getByTestId('new-event-cancel-btn'))
    expect(screen.queryByTestId('new-event-modal')).not.toBeInTheDocument()
  })

  it('opens New Event modal when clicking a date cell as admin with pre-filled date', async () => {
    const user = userEvent.setup()

    render(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
        clubId="club-123"
        token="token-xyz"
      />
    )

    await user.click(screen.getByTestId('calendar-day-2026-11-20'))
    expect(screen.getByTestId('new-event-modal')).toBeInTheDocument()

    const startInput = screen.getByTestId('new-event-start-time-input') as HTMLInputElement
    const endInput = screen.getByTestId('new-event-end-time-input') as HTMLInputElement

    expect(startInput.value).toBe('2026-11-20T18:00')
    expect(endInput.value).toBe('2026-11-20T20:00')
  })

  it('displays client-side validation error when title is missing or end time is before start time', async () => {
    const user = userEvent.setup()

    render(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
        clubId="club-123"
        token="token-xyz"
      />
    )

    await user.click(screen.getByTestId('calendar-new-event-btn'))

    // 1. Missing title
    await user.click(screen.getByTestId('new-event-submit-btn'))
    expect(screen.getByTestId('new-event-error')).toBeInTheDocument()
    expect(screen.getByTestId('new-event-error')).toHaveTextContent(/Event title is required|Titel van evenement is verplicht/i)

    // 2. Set title and set end time before start time
    fireEvent.change(screen.getByTestId('new-event-title-input'), { target: { value: 'AI Summit' } })
    const startInput = screen.getByTestId('new-event-start-time-input')
    const endInput = screen.getByTestId('new-event-end-time-input')

    fireEvent.change(startInput, { target: { value: '2026-11-20T19:00' } })
    fireEvent.change(endInput, { target: { value: '2026-11-20T18:00' } })

    await user.click(screen.getByTestId('new-event-submit-btn'))
    expect(screen.getByTestId('new-event-error')).toBeInTheDocument()
    expect(screen.getByTestId('new-event-error')).toHaveTextContent(/End time must be after start time|Eindtijd moet na de starttijd liggen/i)
  })

  it('submits valid event payload and calls onEventCreated on success', async () => {
    const user = userEvent.setup()
    const onEventCreated = vi.fn()

    const createdMockEvent: ClubEventDto = {
      id: 'new-evt-999',
      clubId: 'club-123',
      title: 'Hackathon 2026',
      description: '24-hour coding challenge',
      location: 'Main Auditorium',
      startTimeUtc: '2026-11-20T18:00:00.000Z',
      endTimeUtc: '2026-11-20T21:00:00.000Z',
      createdByMemberId: 'mem-admin',
      createdAtUtc: '2026-11-16T12:00:00.000Z',
    }

    const createEventFn = vi.fn().mockResolvedValue(createdMockEvent)

    render(
      <ClubCalendarGrid
        events={[]}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
        clubId="club-123"
        token="token-xyz"
        onEventCreated={onEventCreated}
        createEventFn={createEventFn}
      />
    )

    await user.click(screen.getByTestId('calendar-day-2026-11-20'))

    fireEvent.change(screen.getByTestId('new-event-title-input'), { target: { value: 'Hackathon 2026' } })
    fireEvent.change(screen.getByTestId('new-event-description-input'), { target: { value: '24-hour coding challenge' } })
    fireEvent.change(screen.getByTestId('new-event-location-input'), { target: { value: 'Main Auditorium' } })

    await user.click(screen.getByTestId('new-event-submit-btn'))

    expect(createEventFn).toHaveBeenCalledTimes(1)
    expect(createEventFn).toHaveBeenCalledWith(
      'club-123',
      expect.objectContaining({
        title: 'Hackathon 2026',
        description: '24-hour coding challenge',
        location: 'Main Auditorium',
      }),
      'token-xyz'
    )

    expect(screen.queryByTestId('new-event-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('calendar-success-banner')).toHaveTextContent(/Hackathon 2026/i)
    expect(onEventCreated).toHaveBeenCalledWith(createdMockEvent)
  })

  // ========================================================
  // INC-25: Complete Event Details & Edit Event for Club Admin
  // ========================================================

  it('displays complete event details in modal when event pill is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={false}
      />
    )

    await user.click(screen.getByTestId('calendar-event-evt-1'))

    expect(screen.getByTestId('calendar-event-modal')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-modal-title')).toHaveTextContent('Robotics Workshop')
    expect(screen.getByTestId('calendar-modal-location')).toHaveTextContent('Science Lab 4B')
    expect(screen.getByTestId('calendar-modal-description')).toHaveTextContent('Hands-on Arduino workshop for freshmen.')
    expect(screen.getByTestId('calendar-modal-time')).toBeInTheDocument()

    // Non-admin should NOT see the edit button
    expect(screen.queryByTestId('calendar-modal-edit-btn')).not.toBeInTheDocument()

    // Close button dismisses the modal
    await user.click(screen.getByTestId('calendar-modal-close-btn'))
    expect(screen.queryByTestId('calendar-event-modal')).not.toBeInTheDocument()
  })

  it('shows Edit button for club admin and transitions to pre-filled edit form', async () => {
    const user = userEvent.setup()

    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
        clubId="club-123"
      />
    )

    await user.click(screen.getByTestId('calendar-event-evt-1'))

    const editBtn = screen.getByTestId('calendar-modal-edit-btn')
    expect(editBtn).toBeInTheDocument()

    await user.click(editBtn)

    expect(screen.getByTestId('edit-event-form')).toBeInTheDocument()
    expect(screen.getByTestId('edit-event-title-input')).toHaveValue('Robotics Workshop')
    expect(screen.getByTestId('edit-event-location-input')).toHaveValue('Science Lab 4B')
    expect(screen.getByTestId('edit-event-description-input')).toHaveValue('Hands-on Arduino workshop for freshmen.')

    // Cancel edit reverts to details view
    await user.click(screen.getByTestId('edit-event-cancel-btn'))
    expect(screen.queryByTestId('edit-event-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('calendar-modal-title')).toHaveTextContent('Robotics Workshop')
  })

  it('validates empty title and invalid date range when editing event', async () => {
    const user = userEvent.setup()

    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
        clubId="club-123"
      />
    )

    await user.click(screen.getByTestId('calendar-event-evt-1'))
    await user.click(screen.getByTestId('calendar-modal-edit-btn'))

    // 1. Empty title validation
    fireEvent.change(screen.getByTestId('edit-event-title-input'), { target: { value: '   ' } })
    await user.click(screen.getByTestId('edit-event-submit-btn'))

    expect(screen.getByTestId('edit-event-error')).toBeInTheDocument()
    expect(screen.getByTestId('edit-event-error')).toHaveTextContent(/Event title is required|Titel van evenement is verplicht/i)

    // 2. End time before start time validation
    fireEvent.change(screen.getByTestId('edit-event-title-input'), { target: { value: 'Updated Workshop' } })
    fireEvent.change(screen.getByTestId('edit-event-start-time-input'), { target: { value: '2026-11-18T16:00' } })
    fireEvent.change(screen.getByTestId('edit-event-end-time-input'), { target: { value: '2026-11-18T14:00' } })
    await user.click(screen.getByTestId('edit-event-submit-btn'))

    expect(screen.getByTestId('edit-event-error')).toBeInTheDocument()
    expect(screen.getByTestId('edit-event-error')).toHaveTextContent(/End time must be after start time|Eindtijd moet na de starttijd liggen/i)
  })

  it('submits updated event details and triggers onEventUpdated callback on success', async () => {
    const user = userEvent.setup()
    const onEventUpdated = vi.fn()

    const updatedMockEvent: ClubEventDto = {
      id: 'evt-1',
      clubId: 'club-123',
      title: 'Advanced Robotics Workshop & AI Lab',
      description: 'Upgraded curriculum with machine learning modules.',
      location: 'Innovation Hub Room 101',
      startTimeUtc: '2026-11-18T13:00:00.000Z',
      endTimeUtc: '2026-11-18T17:00:00.000Z',
      createdByMemberId: 'mem-admin',
      createdAtUtc: '2026-11-01T10:00:00Z',
    }

    const updateEventFn = vi.fn().mockResolvedValue(updatedMockEvent)

    render(
      <ClubCalendarGrid
        events={sampleEvents}
        clubName="Robotics Club"
        initialDate={fixedDate}
        isAdmin={true}
        clubId="club-123"
        token="admin-token"
        onEventUpdated={onEventUpdated}
        updateEventFn={updateEventFn}
      />
    )

    await user.click(screen.getByTestId('calendar-event-evt-1'))
    await user.click(screen.getByTestId('calendar-modal-edit-btn'))

    fireEvent.change(screen.getByTestId('edit-event-title-input'), { target: { value: 'Advanced Robotics Workshop & AI Lab' } })
    fireEvent.change(screen.getByTestId('edit-event-location-input'), { target: { value: 'Innovation Hub Room 101' } })
    fireEvent.change(screen.getByTestId('edit-event-description-input'), { target: { value: 'Upgraded curriculum with machine learning modules.' } })

    await user.click(screen.getByTestId('edit-event-submit-btn'))

    expect(updateEventFn).toHaveBeenCalledTimes(1)
    expect(updateEventFn).toHaveBeenCalledWith(
      'club-123',
      'evt-1',
      expect.objectContaining({
        title: 'Advanced Robotics Workshop & AI Lab',
        location: 'Innovation Hub Room 101',
        description: 'Upgraded curriculum with machine learning modules.',
      }),
      'admin-token'
    )

    expect(screen.queryByTestId('calendar-event-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('calendar-success-banner')).toHaveTextContent(/Advanced Robotics Workshop & AI Lab/i)
    expect(onEventUpdated).toHaveBeenCalledWith(updatedMockEvent)
  })
})
