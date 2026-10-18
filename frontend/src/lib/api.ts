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
