import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { type ClubDto } from '../lib/api'

export interface ClubSwitcherDropdownProps {
  clubs: ClubDto[]
  activeClubId: string | null
  onSelectClub: (clubId: string) => void
  onClearActiveClub?: () => void
}

export default function ClubSwitcherDropdown({
  clubs,
  activeClubId,
  onSelectClub,
}: ClubSwitcherDropdownProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([])

  const activeClub = clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus management when cycling with arrow keys
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionsRef.current[focusedIndex]) {
      optionsRef.current[focusedIndex]?.focus()
    }
  }, [isOpen, focusedIndex])

  // If user belongs to 0 clubs, do not render a switcher
  if (!clubs || clubs.length === 0) {
    return null
  }

  // If user belongs to only 1 club, show clean active indicator without dropdown complexity
  if (clubs.length === 1 && activeClub) {
    return (
      <div
        data-testid="single-club-indicator"
        className="flex items-center space-x-2 rounded-xl bg-slate-100/90 px-3 py-1.5 text-xs ring-1 ring-slate-200/70"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="font-semibold text-slate-800 truncate max-w-[180px]">
          {activeClub.name}
        </span>
        {activeClub.role && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              activeClub.role === 'Club Admin'
                ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                : 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
            }`}
          >
            {activeClub.role === 'Club Admin'
              ? t('clubSwitcher.roleAdmin')
              : t('clubSwitcher.roleMember')}
          </span>
        )}
      </div>
    )
  }

  function handleTriggerClick() {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        // Focus the currently active club index when opening
        const currentIndex = clubs.findIndex((c) => c.id === activeClub?.id)
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
      }
      return next
    })
  }

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(true)
      const currentIndex = clubs.findIndex((c) => c.id === activeClub?.id)
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
    }
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev + 1) % clubs.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev - 1 + clubs.length) % clubs.length)
    } else if (e.key === 'Tab') {
      setIsOpen(false)
    }
  }

  function handleSelect(clubId: string) {
    onSelectClub(clubId)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left" data-testid="club-switcher">
      <button
        ref={triggerRef}
        type="button"
        id="club-switcher-button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('clubSwitcher.label')}
        className="inline-flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200/90 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer transition-colors max-w-[260px]"
      >
        <span className="flex items-center space-x-2 truncate">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="truncate font-medium">{activeClub?.name ?? t('clubSwitcher.selectClub')}</span>
        </span>
        {activeClub?.role && (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              activeClub.role === 'Club Admin'
                ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                : 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
            }`}
          >
            {activeClub.role === 'Club Admin'
              ? t('clubSwitcher.roleAdmin')
              : t('clubSwitcher.roleMember')}
          </span>
        )}
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={t('clubSwitcher.selectClub')}
          onKeyDown={handleMenuKeyDown}
          className="absolute left-0 z-50 mt-2 w-72 origin-top-left rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200 focus:outline-none"
        >
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t('clubSwitcher.label')}
          </div>
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {clubs.map((club, index) => {
              const isSelected = club.id === activeClub?.id
              return (
                <button
                  key={club.id}
                  ref={(el) => {
                    optionsRef.current[index] = el
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(club.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer focus:outline-none ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-100'
                  }`}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate">{club.name}</span>
                    {club.role && (
                      <span className="text-[10px] text-slate-500">
                        {club.role === 'Club Admin'
                          ? t('clubSwitcher.roleAdmin')
                          : t('clubSwitcher.roleMember')}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <svg
                      className="h-4 w-4 shrink-0 text-indigo-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
