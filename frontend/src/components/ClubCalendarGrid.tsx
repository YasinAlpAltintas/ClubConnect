import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type ClubEventDto, createClubEvent } from '../lib/api'

export interface ClubCalendarGridProps {
  events: ClubEventDto[]
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  clubName: string
  clubId?: string
  token?: string
  isAdmin?: boolean
  initialDate?: Date
  onSelectEvent?: (event: ClubEventDto) => void
  onEventCreated?: (event: ClubEventDto) => void
}

export default function ClubCalendarGrid({
  events,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  clubName,
  clubId,
  token,
  isAdmin = false,
  initialDate,
  onSelectEvent,
  onEventCreated,
}: ClubCalendarGridProps) {
  const { t, i18n } = useTranslation()
  const [currentDate, setCurrentDate] = useState<Date>(() => initialDate ?? new Date())
  const [selectedEvent, setSelectedEvent] = useState<ClubEventDto | null>(null)

  // INC-24: Schedule New Event state
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventStartTime, setEventStartTime] = useState('')
  const [eventEndTime, setEventEndTime] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-indexed (0 = Jan, 11 = Dec)

  const monthName = useMemo(() => {
    const locale = i18n.language === 'nl' || i18n.language === 'nl-BE' ? 'nl-BE' : 'en-US'
    return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }, [currentDate, i18n.language])

  function handlePrevMonth() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function handleNextMonth() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function handleToday() {
    setCurrentDate(new Date())
  }

  function openCreateModal(dateStr?: string) {
    if (!isAdmin) return
    const targetDate = dateStr ?? `${year}-${String(month + 1).padStart(2, '0')}-01`
    setEventTitle('')
    setEventDescription('')
    setEventLocation('')
    setEventStartTime(`${targetDate}T18:00`)
    setEventEndTime(`${targetDate}T20:00`)
    setFormError(null)
    setIsNewEventModalOpen(true)
  }

  function closeCreateModal() {
    setIsNewEventModalOpen(false)
    setFormError(null)
  }

  async function handleCreateEventSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmedTitle = eventTitle.trim()
    if (!trimmedTitle) {
      setFormError(t('calendar.newEvent.errors.titleRequired', 'Event title is required.'))
      return
    }

    if (trimmedTitle.length > 100) {
      setFormError(t('calendar.newEvent.errors.titleTooLong', 'Event title cannot exceed 100 characters.'))
      return
    }

    if (!eventStartTime || !eventEndTime) {
      setFormError(t('calendar.newEvent.errors.datesInvalid', 'End time must be after start time.'))
      return
    }

    const start = new Date(eventStartTime)
    const end = new Date(eventEndTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      setFormError(t('calendar.newEvent.errors.datesInvalid', 'End time must be after start time.'))
      return
    }

    if (!clubId) {
      setFormError('Missing club identifier.')
      return
    }

    setIsSubmitting(true)
    try {
      const created = await createClubEvent(
        clubId,
        {
          title: trimmedTitle,
          description: eventDescription.trim() || undefined,
          location: eventLocation.trim() || undefined,
          startTimeUtc: start.toISOString(),
          endTimeUtc: end.toISOString(),
        },
        token,
      )

      closeCreateModal()
      setSuccessBanner(t('calendar.newEvent.successNotice', { title: created.title, defaultValue: `Event "${created.title}" successfully scheduled!` }))
      setTimeout(() => setSuccessBanner(null), 4000)
      onEventCreated?.(created)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('calendar.newEvent.errors.generic', 'Failed to schedule event.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Construct 35 or 42 grid cells (weeks starting on Monday = index 0)
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()

    // JS getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
    // Convert to Monday = 0: (day + 6) % 7
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7

    const cells: Array<{
      date: Date
      dateString: string
      isCurrentMonth: boolean
      isToday: boolean
      dayNumber: number
    }> = []

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Trailing days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      const cellDate = new Date(year, month - 1, d)
      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({
        date: cellDate,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayNumber: d,
      })
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d)
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({
        date: cellDate,
        dateString: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dayNumber: d,
      })
    }

    // Leading days from next month to complete the row (grid multiple of 7, up to 35 or 42)
    const totalCells = cells.length <= 35 ? 35 : 42
    const remaining = totalCells - cells.length
    for (let d = 1; d <= remaining; d++) {
      const cellDate = new Date(year, month + 1, d)
      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({
        date: cellDate,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayNumber: d,
      })
    }

    return cells
  }, [year, month])

  // Map events to date string (YYYY-MM-DD in local/UTC date)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ClubEventDto[]>()
    for (const evt of events) {
      const d = new Date(evt.startTimeUtc)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const existing = map.get(dateStr) ?? []
      existing.push(evt)
      map.set(dateStr, existing)
    }
    return map
  }, [events])

  const totalMonthEvents = useMemo(() => {
    let count = 0
    for (const cell of calendarCells) {
      if (cell.isCurrentMonth) {
        count += (eventsByDate.get(cell.dateString) ?? []).length
      }
    }
    return count
  }, [calendarCells, eventsByDate])

  function formatTime(isoString: string): string {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  function handleEventClick(event: ClubEventDto, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedEvent(event)
    onSelectEvent?.(event)
  }

  const weekdays = [
    t('calendar.weekdays.mon', 'Mon'),
    t('calendar.weekdays.tue', 'Tue'),
    t('calendar.weekdays.wed', 'Wed'),
    t('calendar.weekdays.thu', 'Thu'),
    t('calendar.weekdays.fri', 'Fri'),
    t('calendar.weekdays.sat', 'Sat'),
    t('calendar.weekdays.sun', 'Sun'),
  ]

  return (
    <section
      data-testid="club-calendar-section"
      aria-label={t('calendar.title', 'Club Calendar')}
      className="rounded-2xl bg-aurora-surface p-6 shadow-xs ring-1 ring-aurora-border text-aurora-text"
    >
      {/* Success Notification Banner */}
      {successBanner && (
        <div
          data-testid="calendar-success-banner"
          className="mb-4 flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20"
        >
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Calendar Header with Controls */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-aurora-border/60">
        <div>
          <div className="flex items-center space-x-3">
            <h2
              data-testid="calendar-month-heading"
              className="text-2xl font-bold tracking-tight text-aurora-text capitalize"
            >
              {monthName}
            </h2>
            <span
              data-testid="calendar-event-count"
              className="inline-flex items-center rounded-full bg-aurora-primary/10 px-2.5 py-0.5 text-xs font-semibold text-aurora-primary ring-1 ring-aurora-primary/20"
            >
              {totalMonthEvents === 1
                ? t('calendar.eventCount_one', '1 event this month')
                : t('calendar.eventCount_other', '{{count}} events this month', { count: totalMonthEvents })}
            </span>
          </div>
          <p className="mt-1 text-xs text-aurora-text-secondary">
            {t('calendar.subtitle', 'Monthly schedule and events for {{clubName}}.', { clubName })}
          </p>
        </div>

        {/* Navigation & Action Buttons */}
        <div className="flex items-center space-x-2">
          {isAdmin && (
            <button
              type="button"
              data-testid="calendar-new-event-btn"
              onClick={() => openCreateModal()}
              className="btn-tactile rounded-xl bg-aurora-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-aurora-primary-hover cursor-pointer transition-colors mr-1"
            >
              + {t('calendar.newEvent.button', 'New Event')}
            </button>
          )}

          <button
            type="button"
            data-testid="calendar-today-btn"
            onClick={handleToday}
            className="btn-tactile rounded-xl bg-aurora-elevated px-3 py-1.5 text-xs font-semibold text-aurora-text ring-1 ring-aurora-border hover:bg-aurora-border cursor-pointer transition-colors"
          >
            {t('calendar.today', 'Today')}
          </button>

          <div className="inline-flex rounded-xl bg-aurora-elevated ring-1 ring-aurora-border p-0.5">
            <button
              type="button"
              data-testid="calendar-prev-btn"
              onClick={handlePrevMonth}
              aria-label={t('calendar.prevMonth', 'Previous Month')}
              className="btn-tactile rounded-lg p-1.5 text-aurora-text-secondary hover:text-aurora-text hover:bg-aurora-surface cursor-pointer transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              data-testid="calendar-next-btn"
              onClick={handleNextMonth}
              aria-label={t('calendar.nextMonth', 'Next Month')}
              className="btn-tactile rounded-lg p-1.5 text-aurora-text-secondary hover:text-aurora-text hover:bg-aurora-surface cursor-pointer transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Loading & Error States */}
      {isLoading && (
        <div data-testid="calendar-loading-spinner" className="flex items-center justify-center py-20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-aurora-primary border-r-transparent" />
        </div>
      )}

      {isError && (
        <div data-testid="calendar-error-banner" className="py-12 text-center">
          <p className="text-sm font-medium text-red-400">
            {errorMessage || t('calendar.errorMessage', 'Failed to retrieve club events.')}
          </p>
          {onRetry && (
            <button
              type="button"
              data-testid="calendar-retry-btn"
              onClick={onRetry}
              className="mt-4 rounded-xl bg-aurora-primary px-4 py-2 text-xs font-semibold text-white hover:bg-aurora-primary-hover cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Weekday Column Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-4 pb-2 text-center">
            {weekdays.map((dayName, idx) => (
              <div
                key={idx}
                data-testid={`calendar-weekday-${idx}`}
                className="text-xs font-semibold uppercase tracking-wider text-aurora-text-secondary py-1"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Monthly Day Grid */}
          <div
            data-testid="calendar-grid"
            className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr"
          >
            {calendarCells.map((cell) => {
              const dayEvents = eventsByDate.get(cell.dateString) ?? []
              return (
                <div
                  key={cell.dateString}
                  data-testid={`calendar-day-${cell.dateString}`}
                  onClick={() => isAdmin && openCreateModal(cell.dateString)}
                  title={isAdmin ? t('calendar.newEvent.clickDatePrompt', 'Click date to schedule') : undefined}
                  className={`min-h-[85px] sm:min-h-[105px] flex flex-col justify-between rounded-xl p-2 transition-all duration-150 ring-1 ${
                    cell.isCurrentMonth
                      ? 'bg-aurora-surface text-aurora-text ring-aurora-border/80'
                      : 'bg-aurora-surface/30 text-aurora-text-muted opacity-40 ring-aurora-border/40'
                  } ${cell.isToday ? 'ring-2 ring-aurora-primary bg-aurora-primary/5' : ''} ${
                    isAdmin ? 'cursor-pointer hover:ring-aurora-primary/60 hover:bg-aurora-elevated/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold rounded-full h-6 w-6 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-aurora-primary text-white font-bold'
                          : 'text-aurora-text'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {cell.isToday && (
                      <span className="hidden sm:inline-block text-[10px] font-semibold text-aurora-primary uppercase tracking-wider">
                        {t('calendar.today', 'Today')}
                      </span>
                    )}
                    {isAdmin && (
                      <span className="opacity-0 hover:opacity-100 text-[10px] text-aurora-primary font-bold">
                        +
                      </span>
                    )}
                  </div>

                  {/* Events Container */}
                  <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <button
                        key={evt.id}
                        type="button"
                        data-testid={`calendar-event-${evt.id}`}
                        onClick={(e) => handleEventClick(evt, e)}
                        className="btn-tactile w-full text-left truncate rounded-md bg-aurora-primary/15 hover:bg-aurora-primary/25 px-1.5 py-0.5 text-[11px] font-medium text-aurora-primary ring-1 ring-aurora-primary/30 cursor-pointer block transition-colors"
                        title={`${evt.title} (${formatTime(evt.startTimeUtc)})`}
                      >
                        <span className="font-semibold mr-1">{formatTime(evt.startTimeUtc)}</span>
                        <span>{evt.title}</span>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] font-semibold text-aurora-text-muted block pl-1">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Month Empty State Notice */}
          {totalMonthEvents === 0 && (
            <div
              data-testid="calendar-empty-notice"
              className="mt-6 rounded-xl border border-dashed border-aurora-border p-6 text-center text-xs text-aurora-text-secondary"
            >
              <p className="font-semibold text-aurora-text">{t('calendar.emptyTitle', 'No events scheduled')}</p>
              <p className="mt-1">{t('calendar.emptyDesc', 'No activities or gatherings are scheduled for this month.')}</p>
            </div>
          )}
        </>
      )}

      {/* Event Details Modal Dialog */}
      {selectedEvent && (
        <div
          data-testid="calendar-event-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-aurora-surface p-6 shadow-xl ring-1 ring-aurora-border text-aurora-text animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center rounded-full bg-aurora-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-aurora-primary ring-1 ring-aurora-primary/20">
                  {clubName}
                </span>
                <h3
                  id="event-dialog-title"
                  data-testid="calendar-modal-title"
                  className="mt-2 text-xl font-bold tracking-tight text-aurora-text"
                >
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                type="button"
                data-testid="calendar-modal-close-btn"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1 text-aurora-text-secondary hover:text-aurora-text cursor-pointer"
                aria-label={t('calendar.eventDetails.close', 'Close')}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center space-x-2 text-aurora-text-secondary">
                <svg className="h-4 w-4 text-aurora-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span data-testid="calendar-modal-time">
                  {new Date(selectedEvent.startTimeUtc).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {formatTime(selectedEvent.startTimeUtc)} – {formatTime(selectedEvent.endTimeUtc)}
                </span>
              </div>

              {selectedEvent.location && (
                <div className="flex items-center space-x-2 text-aurora-text-secondary">
                  <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span data-testid="calendar-modal-location">{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.description && (
                <div className="pt-2 border-t border-aurora-border/60">
                  <p className="text-[11px] font-semibold text-aurora-text-muted uppercase tracking-wider mb-1">
                    {t('calendar.eventDetails.description', 'Description')}
                  </p>
                  <p data-testid="calendar-modal-description" className="text-aurora-text-secondary leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                data-testid="calendar-modal-footer-close-btn"
                onClick={() => setSelectedEvent(null)}
                className="btn-tactile rounded-xl bg-aurora-elevated px-4 py-2 text-xs font-semibold text-aurora-text ring-1 ring-aurora-border hover:bg-aurora-border cursor-pointer transition-colors"
              >
                {t('calendar.eventDetails.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INC-24: Schedule New Event Modal Dialog */}
      {isNewEventModalOpen && (
        <div
          data-testid="new-event-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-event-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-aurora-surface p-6 sm:p-7 shadow-2xl ring-1 ring-aurora-border text-aurora-text animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-4 border-b border-aurora-border/60">
              <div>
                <h3
                  id="new-event-title"
                  data-testid="new-event-modal-title"
                  className="text-lg font-bold tracking-tight text-aurora-text"
                >
                  {t('calendar.newEvent.title', 'Schedule New Event')}
                </h3>
                <p className="text-xs text-aurora-text-secondary mt-0.5">
                  {t('calendar.newEvent.subtitle', 'Add a new activity or gathering to the club calendar.')}
                </p>
              </div>
              <button
                type="button"
                data-testid="new-event-close-btn"
                onClick={closeCreateModal}
                className="rounded-lg p-1 text-aurora-text-secondary hover:text-aurora-text cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div data-testid="new-event-error" className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateEventSubmit} className="mt-5 space-y-4">
              {/* Event Title */}
              <div>
                <label
                  htmlFor="new-event-title-input"
                  className="block text-xs font-semibold text-aurora-text mb-1"
                >
                  {t('calendar.newEvent.fields.title', 'Event Title')} *
                </label>
                <input
                  id="new-event-title-input"
                  type="text"
                  data-testid="new-event-title-input"
                  required
                  maxLength={100}
                  placeholder={t('calendar.newEvent.fields.titlePlaceholder', 'e.g. Weekly Strategy Meeting')}
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-xl bg-aurora-elevated px-3.5 py-2 text-xs text-aurora-text ring-1 ring-aurora-border placeholder:text-aurora-text-muted focus:ring-2 focus:ring-aurora-primary focus:outline-hidden"
                />
              </div>

              {/* Date & Time Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-event-start-time-input"
                    className="block text-xs font-semibold text-aurora-text mb-1"
                  >
                    {t('calendar.newEvent.fields.startTime', 'Start Date & Time')} *
                  </label>
                  <input
                    id="new-event-start-time-input"
                    type="datetime-local"
                    data-testid="new-event-start-time-input"
                    required
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    className="w-full rounded-xl bg-aurora-elevated px-3.5 py-2 text-xs text-aurora-text ring-1 ring-aurora-border focus:ring-2 focus:ring-aurora-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-event-end-time-input"
                    className="block text-xs font-semibold text-aurora-text mb-1"
                  >
                    {t('calendar.newEvent.fields.endTime', 'End Date & Time')} *
                  </label>
                  <input
                    id="new-event-end-time-input"
                    type="datetime-local"
                    data-testid="new-event-end-time-input"
                    required
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full rounded-xl bg-aurora-elevated px-3.5 py-2 text-xs text-aurora-text ring-1 ring-aurora-border focus:ring-2 focus:ring-aurora-primary focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label
                  htmlFor="new-event-location-input"
                  className="block text-xs font-semibold text-aurora-text mb-1"
                >
                  {t('calendar.newEvent.fields.location', 'Location / Room')}
                </label>
                <input
                  id="new-event-location-input"
                  type="text"
                  data-testid="new-event-location-input"
                  maxLength={200}
                  placeholder={t('calendar.newEvent.fields.locationPlaceholder', 'e.g. Campus Building B, Room 2.14')}
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full rounded-xl bg-aurora-elevated px-3.5 py-2 text-xs text-aurora-text ring-1 ring-aurora-border placeholder:text-aurora-text-muted focus:ring-2 focus:ring-aurora-primary focus:outline-hidden"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="new-event-description-input"
                  className="block text-xs font-semibold text-aurora-text mb-1"
                >
                  {t('calendar.newEvent.fields.description', 'Description')}
                </label>
                <textarea
                  id="new-event-description-input"
                  data-testid="new-event-description-input"
                  rows={3}
                  maxLength={1000}
                  placeholder={t('calendar.newEvent.fields.descriptionPlaceholder', 'Optional details, agenda, or materials to bring...')}
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full rounded-xl bg-aurora-elevated px-3.5 py-2 text-xs text-aurora-text ring-1 ring-aurora-border placeholder:text-aurora-text-muted focus:ring-2 focus:ring-aurora-primary focus:outline-hidden resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-aurora-border/60">
                <button
                  type="button"
                  data-testid="new-event-cancel-btn"
                  onClick={closeCreateModal}
                  disabled={isSubmitting}
                  className="btn-tactile rounded-xl bg-aurora-elevated px-4 py-2 text-xs font-semibold text-aurora-text ring-1 ring-aurora-border hover:bg-aurora-border cursor-pointer transition-colors"
                >
                  {t('calendar.newEvent.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  data-testid="new-event-submit-btn"
                  disabled={isSubmitting}
                  className="btn-tactile rounded-xl bg-aurora-primary px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-aurora-primary-hover cursor-pointer disabled:opacity-60 transition-all"
                >
                  {isSubmitting ? t('calendar.newEvent.submitting', 'Scheduling…') : t('calendar.newEvent.submit', 'Schedule Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
