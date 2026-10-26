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

export interface ClubDto {
  id: string
  name: string
  description?: string
  role?: string
  inviteCode?: string
}

export async function getMemberClubs(
  token?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ClubDto[]> {
  const res = await fetchFn('/api/auth/me/clubs', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch member clubs (${res.status})`)
  }

  return (await res.json()) as ClubDto[]
}

export async function getClubDetails(
  clubId: string,
  token?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ClubDto> {
  const res = await fetchFn(`/api/clubs/${clubId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    const error = new Error(`Failed to fetch club details (${res.status})`) as Error & { status?: number }
    error.status = res.status
    throw error
  }

  return (await res.json()) as ClubDto
}

export interface CreateClubRequest {
  name: string
  description?: string
}

export type CreateClubApiError =
  | { code: 'validation'; message?: string }
  | { code: 'unauthorized' }
  | { code: 'network' }
  | { code: 'unexpected'; status: number }

export class CreateClubApiException extends Error {
  readonly apiError: CreateClubApiError

  constructor(apiError: CreateClubApiError) {
    super(CreateClubApiException.messageFor(apiError))
    this.name = 'CreateClubApiException'
    this.apiError = apiError
  }

  private static messageFor(apiError: CreateClubApiError): string {
    if (apiError.code === 'validation') {
      return apiError.message ?? 'validation_failed'
    }
    if (apiError.code === 'unauthorized') {
      return 'unauthorized'
    }
    if (apiError.code === 'network') {
      return 'network'
    }
    return String(apiError.status)
  }
}

export async function createClub(
  request: CreateClubRequest,
  token?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ClubDto> {
  let response: Response
  try {
    response = await fetchFn('/api/clubs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    })
  } catch {
    throw new CreateClubApiException({ code: 'network' })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (response.status === 401) {
    throw new CreateClubApiException({ code: 'unauthorized' })
  }

  if (response.status === 400) {
    const message = extractErrorString(payload)
    throw new CreateClubApiException({ code: 'validation', message })
  }

  if (!response.ok) {
    throw new CreateClubApiException({ code: 'unexpected', status: response.status })
  }

  const data = payload as { id: string; name: string; description?: string; role: string; inviteCode?: string }
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    role: data.role,
    inviteCode: data.inviteCode,
  }
}

export interface JoinClubRequest {
  code: string
}

export type JoinClubApiError =
  | { code: 'validation'; message?: string }
  | { code: 'unauthorized' }
  | { code: 'notFound'; message?: string }
  | { code: 'alreadyMember'; message?: string }
  | { code: 'expired'; message?: string }
  | { code: 'rateLimited'; message?: string }
  | { code: 'network' }
  | { code: 'unexpected'; status: number }

export class JoinClubApiException extends Error {
  readonly apiError: JoinClubApiError

  constructor(apiError: JoinClubApiError) {
    super(JoinClubApiException.messageFor(apiError))
    this.name = 'JoinClubApiException'
    this.apiError = apiError
  }

  private static messageFor(apiError: JoinClubApiError): string {
    if (apiError.code === 'validation') {
      return apiError.message ?? 'validation_failed'
    }
    if (apiError.code === 'unauthorized') {
      return 'unauthorized'
    }
    if (apiError.code === 'notFound') {
      return apiError.message ?? 'not_found'
    }
    if (apiError.code === 'alreadyMember') {
      return apiError.message ?? 'already_member'
    }
    if (apiError.code === 'expired') {
      return apiError.message ?? 'expired'
    }
    if (apiError.code === 'rateLimited') {
      return apiError.message ?? 'rate_limited'
    }
    if (apiError.code === 'network') {
      return 'network'
    }
    return String(apiError.status)
  }
}

export async function joinClub(
  request: JoinClubRequest,
  token?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ClubDto> {
  let response: Response
  try {
    response = await fetchFn('/api/clubs/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    })
  } catch {
    throw new JoinClubApiException({ code: 'network' })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (response.status === 401) {
    throw new JoinClubApiException({ code: 'unauthorized' })
  }

  if (response.status === 400) {
    const message = extractErrorString(payload)
    throw new JoinClubApiException({ code: 'validation', message })
  }

  if (response.status === 404) {
    const message = extractErrorString(payload)
    throw new JoinClubApiException({ code: 'notFound', message })
  }

  if (response.status === 409) {
    const message = extractErrorString(payload)
    throw new JoinClubApiException({ code: 'alreadyMember', message })
  }

  if (response.status === 410) {
    const message = extractErrorString(payload)
    throw new JoinClubApiException({ code: 'expired', message })
  }

  if (response.status === 429) {
    const message = extractErrorString(payload)
    throw new JoinClubApiException({ code: 'rateLimited', message })
  }

  if (!response.ok) {
    throw new JoinClubApiException({ code: 'unexpected', status: response.status })
  }

  const data = payload as { clubId?: string; id?: string; name: string; description?: string; role: string }
  return {
    id: data.clubId ?? data.id ?? '',
    name: data.name,
    description: data.description,
    role: data.role,
  }
}
