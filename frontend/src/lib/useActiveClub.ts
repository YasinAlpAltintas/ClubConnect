import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ClubDto } from './api'

export const ACTIVE_CLUB_STORAGE_PREFIX = 'clubconnect:active_club:'

export function getStoredActiveClubId(memberId?: string): string | null {
  if (!memberId || typeof window === 'undefined') return null
  try {
    return localStorage.getItem(`${ACTIVE_CLUB_STORAGE_PREFIX}${memberId}`)
  } catch {
    return null
  }
}

export function setStoredActiveClubId(memberId: string | undefined, clubId: string | null): void {
  if (!memberId || typeof window === 'undefined') return
  try {
    if (clubId) {
      localStorage.setItem(`${ACTIVE_CLUB_STORAGE_PREFIX}${memberId}`, clubId)
    } else {
      localStorage.removeItem(`${ACTIVE_CLUB_STORAGE_PREFIX}${memberId}`)
    }
  } catch {
    // Gracefully handle storage quotas / privacy modes
  }
}

export interface UseActiveClubOptions {
  clubs: ClubDto[]
  memberId?: string
  initialActiveClubId?: string | null
}

export interface UseActiveClubResult {
  activeClubId: string | null
  activeClub: ClubDto | null
  setActiveClubId: (clubId: string) => boolean
  clearActiveClub: () => void
}

/**
 * State hook managing active tenant club selection with safe fallback,
 * member-scoped persistence, and tenant validation.
 */
export function useActiveClub({
  clubs,
  memberId,
  initialActiveClubId,
}: UseActiveClubOptions): UseActiveClubResult {
  const [selectedId, setSelectedId] = useState<string | null | undefined>(() => {
    if (initialActiveClubId !== undefined) {
      return initialActiveClubId
    }
    const stored = getStoredActiveClubId(memberId)
    return stored ?? undefined
  })

  // Synchronize and validate active club against accessible clubs
  const activeClubId = useMemo<string | null>(() => {
    if (!clubs || clubs.length === 0) {
      return null
    }

    // Deliberate clear / no selection
    if (selectedId === null) {
      return null
    }

    // Check if current selection is in accessible clubs
    if (selectedId && clubs.some((c) => c.id === selectedId)) {
      return selectedId
    }

    // Check if stored selection is in accessible clubs
    if (selectedId === undefined) {
      const stored = getStoredActiveClubId(memberId)
      if (stored && clubs.some((c) => c.id === stored)) {
        return stored
      }
    }

    // Fallback to first accessible club
    return clubs[0]?.id ?? null
  }, [clubs, selectedId, memberId])

  // Sync back to state and localStorage when selection changes
  useEffect(() => {
    if (activeClubId !== selectedId) {
      setSelectedId(activeClubId)
    }
    if (memberId) {
      setStoredActiveClubId(memberId, activeClubId)
    }
  }, [activeClubId, selectedId, memberId])

  const activeClub = useMemo(() => {
    if (!activeClubId || !clubs) return null
    return clubs.find((c) => c.id === activeClubId) ?? null
  }, [clubs, activeClubId])

  const setActiveClubId = useCallback(
    (clubId: string): boolean => {
      // Security guard: ensure club belongs to user's accessible clubs
      const exists = clubs.some((c) => c.id === clubId)
      if (!exists) {
        return false
      }

      setSelectedId(clubId)
      if (memberId) {
        setStoredActiveClubId(memberId, clubId)
      }
      return true
    },
    [clubs, memberId],
  )

  const clearActiveClub = useCallback(() => {
    setSelectedId(null)
    if (memberId) {
      setStoredActiveClubId(memberId, null)
    }
  }, [memberId])

  return {
    activeClubId,
    activeClub,
    setActiveClubId,
    clearActiveClub,
  }
}
