import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useActiveClub,
  getStoredActiveClubId,
  setStoredActiveClubId,
  ACTIVE_CLUB_STORAGE_PREFIX,
} from './useActiveClub'
import { type ClubDto } from './api'

describe('useActiveClub', () => {
  const memberA = 'member-a'
  const memberB = 'member-b'

  const sampleClubs: ClubDto[] = [
    { id: 'club-1', name: 'Leuven Coding Society', role: 'Club Admin' },
    { id: 'club-2', name: 'Campus Robotics', role: 'Club Member' },
    { id: 'club-3', name: 'Debate Club', role: 'Club Member' },
  ]

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when clubs list is empty', () => {
    const { result } = renderHook(() =>
      useActiveClub({ clubs: [], memberId: memberA }),
    )

    expect(result.current.activeClubId).toBeNull()
    expect(result.current.activeClub).toBeNull()
  })

  it('defaults to first accessible club when no previous preference is stored', () => {
    const { result } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberA }),
    )

    expect(result.current.activeClubId).toBe('club-1')
    expect(result.current.activeClub?.name).toBe('Leuven Coding Society')
    expect(getStoredActiveClubId(memberA)).toBe('club-1')
  })

  it('restores stored club selection scoped to memberId from localStorage', () => {
    setStoredActiveClubId(memberA, 'club-2')

    const { result } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberA }),
    )

    expect(result.current.activeClubId).toBe('club-2')
    expect(result.current.activeClub?.name).toBe('Campus Robotics')
  })

  it('falls back to first club if stored club is not in accessible clubs', () => {
    setStoredActiveClubId(memberA, 'unauthorized-club-99')

    const { result } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberA }),
    )

    expect(result.current.activeClubId).toBe('club-1')
    expect(result.current.activeClub?.id).toBe('club-1')
  })

  it('switches active club and updates member-scoped localStorage on setActiveClubId', () => {
    const { result } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberA }),
    )

    let success = false
    act(() => {
      success = result.current.setActiveClubId('club-3')
    })

    expect(success).toBe(true)
    expect(result.current.activeClubId).toBe('club-3')
    expect(result.current.activeClub?.name).toBe('Debate Club')
    expect(getStoredActiveClubId(memberA)).toBe('club-3')
  })

  it('rejects setActiveClubId if clubId is not in accessible clubs', () => {
    const { result } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberA }),
    )

    let success = false
    act(() => {
      success = result.current.setActiveClubId('attacker-club-666')
    })

    expect(success).toBe(false)
    expect(result.current.activeClubId).toBe('club-1')
    expect(getStoredActiveClubId(memberA)).toBe('club-1')
  })

  it('preserves multi-user isolation on the same browser', () => {
    setStoredActiveClubId(memberA, 'club-2')
    setStoredActiveClubId(memberB, 'club-3')

    const { result: resultA } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberA }),
    )
    const { result: resultB } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberB }),
    )

    expect(resultA.current.activeClubId).toBe('club-2')
    expect(resultB.current.activeClubId).toBe('club-3')
    expect(localStorage.getItem(`${ACTIVE_CLUB_STORAGE_PREFIX}${memberA}`)).toBe('club-2')
    expect(localStorage.getItem(`${ACTIVE_CLUB_STORAGE_PREFIX}${memberB}`)).toBe('club-3')
  })

  it('clears active club when clearActiveClub is called', () => {
    setStoredActiveClubId(memberA, 'club-2')

    const { result } = renderHook(() =>
      useActiveClub({ clubs: sampleClubs, memberId: memberA }),
    )

    act(() => {
      result.current.clearActiveClub()
    })

    expect(result.current.activeClubId).toBeNull()
    expect(result.current.activeClub).toBeNull()
    expect(getStoredActiveClubId(memberA)).toBeNull()
  })
})
