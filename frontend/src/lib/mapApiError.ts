import { RegisterApiException, type RegisterApiError } from './api'

export type ApiErrorKey = 'conflict' | 'invalid_email' | 'invalid_password' | 'network' | 'unexpected'

export interface ResolvedApiError {
  key: ApiErrorKey
  status?: number
}

export function apiErrorToKey(error: unknown): ResolvedApiError {
  if (error instanceof RegisterApiException) {
    return mapApiError(error.apiError)
  }
  return { key: 'network' }
}

function isPasswordViolation(message: string | undefined): boolean {
  if (!message) return false
  return message.toLowerCase().startsWith('password')
}

function mapApiError(error: RegisterApiError): ResolvedApiError {
  switch (error.code) {
    case 'conflict':
      return { key: 'conflict' }
    case 'validation':
      return isPasswordViolation(error.message)
        ? { key: 'invalid_password' }
        : { key: 'invalid_email' }
    case 'network':
      return { key: 'network' }
    case 'unexpected':
      return { key: 'unexpected', status: error.status }
  }
}
