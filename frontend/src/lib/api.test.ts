import { describe, expect, it } from 'vitest'
import {
  classifyRegisterError,
  registerMember,
  RegisterApiException,
  classifyLoginError,
  loginMember,
  LoginApiException,
  checkEmailExists,
  getAuthProfile,
  logoutMember,
  getMemberClubs,
} from './api'
import { loginApiErrorToKey } from './mapApiError'


function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('classifyRegisterError', () => {
  it('maps 409 to conflict', () => {
    expect(classifyRegisterError(409, undefined)).toEqual({ code: 'conflict' })
  })

  it('maps 400 with detail to validation with the detail message', () => {
    const result = classifyRegisterError(400, {
      error: 'invalid_input',
      detail: 'E-mail is not valid.',
    })
    expect(result).toEqual({ code: 'validation', message: 'E-mail is not valid.' })
  })

  it('falls back to the error field when detail is missing', () => {
    const result = classifyRegisterError(400, { error: 'invalid_input' })
    expect(result).toEqual({ code: 'validation', message: 'invalid_input' })
  })

  it('returns an undefined message for an empty 400 body', () => {
    expect(classifyRegisterError(400, undefined)).toEqual({
      code: 'validation',
      message: undefined,
    })
  })

  it('maps a fetch failure (status 0) to network', () => {
    expect(classifyRegisterError(0, undefined)).toEqual({ code: 'network' })
  })

  it('maps other statuses to unexpected with the status preserved', () => {
    expect(classifyRegisterError(503, undefined)).toEqual({
      code: 'unexpected',
      status: 503,
    })
  })
})

describe('registerMember', () => {
  it('returns memberId and email on 201', async () => {
    const fetchFn = (async () =>
      jsonResponse(
        { memberId: 'abc-123', email: 'user@example.com' },
        201,
      )) as typeof fetch

    const result = await registerMember(
      { email: 'user@example.com', password: 'Secret12' },
      fetchFn,
    )

    expect(result).toEqual({ memberId: 'abc-123', email: 'user@example.com' })
  })

  it('sends a POST request with the expected body', async () => {
    let capturedInit: RequestInit | undefined
    let capturedUrl = ''
    const fetchFn = (async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      return jsonResponse({ memberId: 'id', email: 'e' }, 201)
    }) as typeof fetch

    await registerMember({ email: 'a@b.co', password: 'Secret12' }, fetchFn)

    expect(capturedUrl).toBe('/api/auth/register')
    expect(capturedInit?.method).toBe('POST')
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      email: 'a@b.co',
      password: 'Secret12',
      displayName: null,
    })
  })

  it('throws a network exception when fetch rejects', async () => {
    const fetchFn = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch

    const promise = registerMember({ email: 'a@b.co', password: 'Secret12' }, fetchFn)
    await expect(promise).rejects.toThrow(RegisterApiException)
  })

  it('throws a validation exception on 400', async () => {
    const fetchFn = (async () =>
      jsonResponse(
        { error: 'invalid_input', detail: 'E-mail is not valid.' },
        400,
      )) as typeof fetch

    const promise = registerMember({ email: 'x', password: 'Secret12' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'validation', message: 'E-mail is not valid.' },
    })
  })

  it('throws a conflict exception on 409', async () => {
    const fetchFn = (async () =>
      jsonResponse(
        { error: 'email_conflict', detail: 'E-mail is already in use.' },
        409,
      )) as typeof fetch

    const promise = registerMember({ email: 'x', password: 'Secret12' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'conflict' },
    })
  })

  it('throws an unexpected exception on 500', async () => {
    const fetchFn = (async () => jsonResponse({}, 500)) as typeof fetch

    const promise = registerMember({ email: 'x', password: 'Secret12' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'unexpected', status: 500 },
    })
  })

  it('tolerates a non-JSON 500 body', async () => {
    const fetchFn = (async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }) as unknown as Response) as typeof fetch

    const promise = registerMember({ email: 'x', password: 'Secret12' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'unexpected', status: 500 },
    })
  })
})

describe('classifyLoginError', () => {
  it('maps 401 with detail to invalid_credentials', () => {
    const result = classifyLoginError(401, {
      error: 'invalid_credentials',
      detail: 'Invalid email or password.',
    })
    expect(result).toEqual({
      code: 'invalid_credentials',
      message: 'Invalid email or password.',
    })
  })

  it('maps 400 with detail to validation', () => {
    const result = classifyLoginError(400, {
      error: 'invalid_input',
      detail: 'Email and password are required.',
    })
    expect(result).toEqual({
      code: 'validation',
      message: 'Email and password are required.',
    })
  })

  it('maps status 0 to network', () => {
    expect(classifyLoginError(0, undefined)).toEqual({ code: 'network' })
  })

  it('maps other status to unexpected', () => {
    expect(classifyLoginError(500, undefined)).toEqual({
      code: 'unexpected',
      status: 500,
    })
  })
})

describe('loginMember', () => {
  it('returns member details and token on 200', async () => {
    const fetchFn = (async () =>
      jsonResponse(
        { memberId: 'member-123', email: 'user@example.com', displayName: 'User', token: 'jwt-token-123' },
        200,
      )) as typeof fetch

    const result = await loginMember(
      { email: 'user@example.com', password: 'SecretPassword1' },
      fetchFn,
    )

    expect(result).toEqual({
      memberId: 'member-123',
      email: 'user@example.com',
      displayName: 'User',
      token: 'jwt-token-123',
    })
  })

  it('sends POST request to /api/auth/login', async () => {
    let capturedInit: RequestInit | undefined
    let capturedUrl = ''
    const fetchFn = (async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      return jsonResponse({ memberId: 'id', email: 'user@example.com' }, 200)
    }) as typeof fetch

    await loginMember({ email: 'user@example.com', password: 'Password1' }, fetchFn)

    expect(capturedUrl).toBe('/api/auth/login')
    expect(capturedInit?.method).toBe('POST')
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      email: 'user@example.com',
      password: 'Password1',
    })
  })

  it('throws LoginApiException network error when fetch rejects', async () => {
    const fetchFn = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch

    const promise = loginMember({ email: 'user@example.com', password: 'Password1' }, fetchFn)
    await expect(promise).rejects.toThrow(LoginApiException)
  })

  it('throws LoginApiException with invalid_credentials on 401', async () => {
    const fetchFn = (async () =>
      jsonResponse(
        { error: 'invalid_credentials', detail: 'Invalid email or password.' },
        401,
      )) as typeof fetch

    const promise = loginMember({ email: 'user@example.com', password: 'Wrong' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'invalid_credentials', message: 'Invalid email or password.' },
    })
  })

  it('throws LoginApiException with validation on 400', async () => {
    const fetchFn = (async () =>
      jsonResponse(
        { error: 'invalid_input', detail: 'Email is required' },
        400,
      )) as typeof fetch

    const promise = loginMember({ email: '', password: 'Wrong' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'validation', message: 'Email is required' },
    })
  })

  it('throws LoginApiException unexpected on 500', async () => {
    const fetchFn = (async () => jsonResponse({}, 500)) as typeof fetch

    const promise = loginMember({ email: 'user@example.com', password: 'Password1' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'unexpected', status: 500 },
    })
  })

  it('tolerates non-JSON body on error response', async () => {
    const fetchFn = (async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Bad gateway')
      },
    }) as unknown as Response) as typeof fetch

    const promise = loginMember({ email: 'user@example.com', password: 'Password1' }, fetchFn)
    await expect(promise).rejects.toMatchObject({
      apiError: { code: 'unexpected', status: 502 },
    })
  })
})

describe('loginApiErrorToKey', () => {
  it('maps invalid_credentials error correctly', () => {
    const err = new LoginApiException({ code: 'invalid_credentials' })
    expect(loginApiErrorToKey(err)).toEqual({ key: 'invalid_credentials' })
  })

  it('maps validation error to invalid_input', () => {
    const err = new LoginApiException({ code: 'validation' })
    expect(loginApiErrorToKey(err)).toEqual({ key: 'invalid_input' })
  })

  it('maps network error to network', () => {
    const err = new LoginApiException({ code: 'network' })
    expect(loginApiErrorToKey(err)).toEqual({ key: 'network' })
  })

  it('maps unexpected error with status', () => {
    const err = new LoginApiException({ code: 'unexpected', status: 500 })
    expect(loginApiErrorToKey(err)).toEqual({ key: 'unexpected', status: 500 })
  })

  it('maps non-LoginApiException to network', () => {
    expect(loginApiErrorToKey(new Error('other'))).toEqual({ key: 'network' })
  })
})

describe('checkEmailExists', () => {
  it('returns true when API returns exists: true', async () => {
    const fetchFn = (async () => jsonResponse({ exists: true })) as typeof fetch
    const exists = await checkEmailExists('existing@example.com', fetchFn)
    expect(exists).toBe(true)
  })

  it('returns false when API returns exists: false', async () => {
    const fetchFn = (async () => jsonResponse({ exists: false })) as typeof fetch
    const exists = await checkEmailExists('new@example.com', fetchFn)
    expect(exists).toBe(false)
  })

  it('returns false when fetch fails', async () => {
    const fetchFn = (async () => {
      throw new Error('Network error')
    }) as typeof fetch
    const exists = await checkEmailExists('new@example.com', fetchFn)
    expect(exists).toBe(false)
  })

  it('returns false on non-200 response', async () => {
    const fetchFn = (async () => jsonResponse({}, 400)) as typeof fetch
    const exists = await checkEmailExists('bad', fetchFn)
    expect(exists).toBe(false)
  })
})

describe('getAuthProfile', () => {
  it('returns profile when response is 200', async () => {
    const fetchFn = (async () =>
      jsonResponse(
        { memberId: 'm-1', email: 'ada@example.com', displayName: 'Ada' },
        200,
      )) as typeof fetch

    const profile = await getAuthProfile('my-token', fetchFn)
    expect(profile).toEqual({
      memberId: 'm-1',
      email: 'ada@example.com',
      displayName: 'Ada',
      token: 'my-token',
    })
  })

  it('throws LoginApiException on 401', async () => {
    const fetchFn = (async () =>
      jsonResponse({ error: 'token_expired' }, 401)) as typeof fetch

    await expect(getAuthProfile('expired-token', fetchFn)).rejects.toThrow(LoginApiException)
  })

  it('throws LoginApiException on network failure', async () => {
    const fetchFn = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch

    await expect(getAuthProfile('token', fetchFn)).rejects.toThrow(LoginApiException)
  })
})

describe('logoutMember', () => {
  it('calls POST /api/auth/logout with authorization header when token is provided', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined

    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedInit = init
      return jsonResponse({ message: 'Logged out' }, 200)
    }) as typeof fetch

    await logoutMember('my-token', fetchFn)

    expect(capturedUrl).toBe('/api/auth/logout')
    expect(capturedInit?.method).toBe('POST')
    expect((capturedInit?.headers as Record<string, string>)?.Authorization).toBe('Bearer my-token')
  })

  it('gracefully handles network error on logout', async () => {
    const fetchFn = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch

    await expect(logoutMember('my-token', fetchFn)).resolves.toBeUndefined()
  })
})

describe('getMemberClubs', () => {
  it('calls GET /api/auth/me/clubs with authorization header and returns clubs list', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined

    const dummyClubs = [
      { id: 'club-1', name: 'Computer Science Club', description: 'Tech enthusiasts', role: 'Member' }
    ]

    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedInit = init
      return jsonResponse(dummyClubs, 200)
    }) as typeof fetch

    const result = await getMemberClubs('my-token', fetchFn)

    expect(capturedUrl).toBe('/api/auth/me/clubs')
    expect(capturedInit?.method).toBe('GET')
    expect((capturedInit?.headers as Record<string, string>)?.Authorization).toBe('Bearer my-token')
    expect(result).toEqual(dummyClubs)
  })

  it('calls GET /api/auth/me/clubs without authorization header when token is not provided', async () => {
    let capturedInit: RequestInit | undefined

    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init
      return jsonResponse([], 200)
    }) as typeof fetch

    const result = await getMemberClubs(undefined, fetchFn)
    expect(result).toEqual([])
    expect((capturedInit?.headers as Record<string, string>)?.Authorization).toBeUndefined()
  })

  it('throws error when server responds with non-ok status', async () => {
    const fetchFn = (async () => jsonResponse({ error: 'unauthorized' }, 401)) as typeof fetch
    await expect(getMemberClubs('bad-token', fetchFn)).rejects.toThrow('Failed to fetch member clubs (401)')
  })
})


