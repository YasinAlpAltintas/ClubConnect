import { describe, expect, it } from 'vitest'
import {
  classifyRegisterError,
  registerMember,
  RegisterApiException,
} from './api'

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
