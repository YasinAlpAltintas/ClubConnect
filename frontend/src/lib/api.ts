export interface RegisterRequest {
  email: string
  password: string
}

export interface RegisterSuccessResponse {
  memberId: string
  email: string
}

export type RegisterApiErrorCode = 'conflict' | 'validation' | 'network'

export type RegisterApiError =
  | { code: 'conflict' }
  | { code: 'validation'; message?: string }
  | { code: 'network' }
  | { code: 'unexpected'; status: number }

export class RegisterApiException extends Error {
  readonly apiError: RegisterApiError

  constructor(apiError: RegisterApiError) {
    super(RegisterApiException.messageFor(apiError))
    this.name = 'RegisterApiException'
    this.apiError = apiError
  }

  private static messageFor(apiError: RegisterApiError): string {
    if (apiError.code === 'validation') {
      return apiError.message ?? 'invalid'
    }
    if (apiError.code === 'conflict') {
      return 'conflict'
    }
    if (apiError.code === 'network') {
      return 'network'
    }
    return String(apiError.status)
  }
}

export function classifyRegisterError(status: number, body: unknown): RegisterApiError {
  if (status === 409) {
    return { code: 'conflict' }
  }
  if (status === 400) {
    const message = extractErrorString(body)
    return { code: 'validation', message }
  }
  if (status === 0) {
    return { code: 'network' }
  }
  return { code: 'unexpected', status }
}

function extractErrorString(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    if (typeof obj.detail === 'string') {
      return obj.detail
    }
    if (typeof obj.error === 'string') {
      return obj.error
    }
  }
  return undefined
}

export async function registerMember(
  request: RegisterRequest,
  fetchFn: typeof fetch = fetch,
): Promise<RegisterSuccessResponse> {
  let response: Response
  try {
    response = await fetchFn('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, displayName: null }),
    })
  } catch {
    throw new RegisterApiException({ code: 'network' })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    throw new RegisterApiException(classifyRegisterError(response.status, payload))
  }

  const data = payload as RegisterSuccessResponse
  return { memberId: data.memberId, email: data.email }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginSuccessResponse {
  memberId: string
  email: string
  displayName?: string | null
  token: string
}

export type LoginApiErrorCode = 'invalid_credentials' | 'validation' | 'network'

export type LoginApiError =
  | { code: 'invalid_credentials'; message?: string }
  | { code: 'validation'; message?: string }
  | { code: 'network' }
  | { code: 'unexpected'; status: number }

export class LoginApiException extends Error {
  readonly apiError: LoginApiError

  constructor(apiError: LoginApiError) {
    super(LoginApiException.messageFor(apiError))
    this.name = 'LoginApiException'
    this.apiError = apiError
  }

  private static messageFor(apiError: LoginApiError): string {
    if (apiError.code === 'invalid_credentials') {
      return apiError.message ?? 'invalid_credentials'
    }
    if (apiError.code === 'validation') {
      return apiError.message ?? 'invalid'
    }
    if (apiError.code === 'network') {
      return 'network'
    }
    return String(apiError.status)
  }
}

export function classifyLoginError(status: number, body: unknown): LoginApiError {
  if (status === 401) {
    const message = extractErrorString(body)
    return { code: 'invalid_credentials', message }
  }
  if (status === 400) {
    const message = extractErrorString(body)
    return { code: 'validation', message }
  }
  if (status === 0) {
    return { code: 'network' }
  }
  return { code: 'unexpected', status }
}

export async function loginMember(
  request: LoginRequest,
  fetchFn: typeof fetch = fetch,
): Promise<LoginSuccessResponse> {
  let response: Response
  try {
    response = await fetchFn('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  } catch {
    throw new LoginApiException({ code: 'network' })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    throw new LoginApiException(classifyLoginError(response.status, payload))
  }

  const data = payload as LoginSuccessResponse
  return {
    memberId: data.memberId,
    email: data.email,
    displayName: data.displayName,
    token: data.token,
  }
}

export async function checkEmailExists(
  email: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchFn(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
    if (!response.ok) return false
    const data = (await response.json()) as { exists?: boolean }
    return Boolean(data.exists)
  } catch {
    return false
  }
}

export async function getAuthProfile(
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<LoginSuccessResponse> {
  let response: Response
  try {
    response = await fetchFn('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new LoginApiException({ code: 'network' })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    throw new LoginApiException(classifyLoginError(response.status, payload))
  }

  const data = payload as LoginSuccessResponse
  return {
    memberId: data.memberId,
    email: data.email,
    displayName: data.displayName,
    token,
  }
}

export async function logoutMember(
  token?: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchFn('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch {
    // Graceful offline/network failure: client session will still be cleared
  }
}

