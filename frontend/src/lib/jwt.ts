export interface JwtClaims {
  sub?: string
  email?: string
  name?: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

/**
 * Safely parses the claims payload of a JWT without verifying the signature.
 * Uses standard base64 decoding.
 */
export function parseJwt(token: string): JwtClaims | null {
  if (!token || typeof token !== 'string') {
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = atob(padded)
    return JSON.parse(json) as JwtClaims
  } catch {
    return null
  }
}

/**
 * Returns true if the JWT is expired or malformed.
 * @param token The JWT token to check.
 * @param clockSkewSeconds Optional clock skew allowance in seconds (default 0).
 */
export function isTokenExpired(token: string, clockSkewSeconds = 0): boolean {
  const claims = parseJwt(token)
  if (!claims || typeof claims.exp !== 'number') {
    return true
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  return nowSeconds >= claims.exp - clockSkewSeconds
}

/**
 * Calculates remaining lifetime of the token in milliseconds.
 * Returns 0 if expired or malformed.
 */
export function getTokenRemainingTimeMs(token: string): number {
  const claims = parseJwt(token)
  if (!claims || typeof claims.exp !== 'number') {
    return 0
  }

  const remainingMs = claims.exp * 1000 - Date.now()
  return Math.max(0, remainingMs)
}

export const TOKEN_STORAGE_KEY = 'clubconnect_token'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // Ignore storage quota or access errors
  }
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Ignore
  }
}
