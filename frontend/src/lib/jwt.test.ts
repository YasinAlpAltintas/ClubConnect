import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseJwt,
  isTokenExpired,
  getTokenRemainingTimeMs,
  type JwtClaims,
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  TOKEN_STORAGE_KEY,
} from './jwt'

function makeTestJwt(claims: JwtClaims): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const payload = btoa(JSON.stringify(claims))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${header}.${payload}.signature`
}

describe('jwt utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses valid JWT claims', () => {
    const claims: JwtClaims = {
      sub: 'mem-123',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      exp: 1800000000,
    }
    const token = makeTestJwt(claims)

    const parsed = parseJwt(token)
    expect(parsed).toEqual(claims)
  })

  it('returns null for malformed tokens', () => {
    expect(parseJwt('')).toBeNull()
    expect(parseJwt('not.a.token.with.many.dots')).toBeNull()
    expect(parseJwt('invalid')).toBeNull()
    expect(parseJwt('a.b')).toBeNull()
    expect(parseJwt('a.invalid_base64_json!@#.c')).toBeNull()
  })

  it('detects unexpired token', () => {
    vi.setSystemTime(new Date(1000000000 * 1000))
    const token = makeTestJwt({ exp: 1000000000 + 3600 })

    expect(isTokenExpired(token)).toBe(false)
  })

  it('detects expired token', () => {
    vi.setSystemTime(new Date(1000000000 * 1000))
    const token = makeTestJwt({ exp: 1000000000 - 60 })

    expect(isTokenExpired(token)).toBe(true)
  })

  it('treats token without exp claim as expired', () => {
    const token = makeTestJwt({ sub: 'user' })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('calculates remaining time in milliseconds correctly', () => {
    const now = 1000000000 * 1000
    vi.setSystemTime(new Date(now))

    const token = makeTestJwt({ exp: 1000000000 + 120 })
    expect(getTokenRemainingTimeMs(token)).toBe(120 * 1000)

    const expiredToken = makeTestJwt({ exp: 1000000000 - 10 })
    expect(getTokenRemainingTimeMs(expiredToken)).toBe(0)

    expect(getTokenRemainingTimeMs('invalid')).toBe(0)
  })

  it('manages token storage in localStorage', () => {
    window.localStorage.clear()
    expect(getStoredToken()).toBeNull()

    setStoredToken('test-token-123')
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('test-token-123')
    expect(getStoredToken()).toBe('test-token-123')

    removeStoredToken()
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(getStoredToken()).toBeNull()
  })
})
