import {
  RegisterApiException,
  type RegisterApiError,
  LoginApiException,
  type LoginApiError,
} from './api'

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

export type LoginErrorKey = 'invalid_credentials' | 'invalid_input' | 'network' | 'unexpected'

export interface ResolvedLoginApiError {
  key: LoginErrorKey
  status?: number
}

export function loginApiErrorToKey(error: unknown): ResolvedLoginApiError {
  if (error instanceof LoginApiException) {
    return mapLoginApiError(error.apiError)
  }
  return { key: 'network' }
}

function mapLoginApiError(error: LoginApiError): ResolvedLoginApiError {
  switch (error.code) {
    case 'invalid_credentials':
      return { key: 'invalid_credentials' }
    case 'validation':
      return { key: 'invalid_input' }
    case 'network':
      return { key: 'network' }
    case 'unexpected':
      return { key: 'unexpected', status: error.status }
  }
}

