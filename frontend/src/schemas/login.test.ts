import { describe, expect, it } from 'vitest'
import { loginSchema } from './login'

describe('loginSchema', () => {
  it('accepts a valid login payload', () => {
    const result = loginSchema.safeParse({
      email: 'member@example.com',
      password: 'SecretPassword123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty email with required error', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'SecretPassword123',
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error.issues[0]).toMatchObject({
      path: ['email'],
      message: 'required',
    })
  })

  it('rejects a malformed email with email_invalid error', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'SecretPassword123',
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error.issues[0]).toMatchObject({
      path: ['email'],
      message: 'email_invalid',
    })
  })

  it('rejects an email that exceeds 254 characters', () => {
    const result = loginSchema.safeParse({
      email: `${'a'.repeat(255)}@example.com`,
      password: 'SecretPassword123',
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error.issues[0]?.message).toBe('email_invalid')
  })

  it('rejects an empty password with required error', () => {
    const result = loginSchema.safeParse({
      email: 'member@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error.issues[0]).toMatchObject({
      path: ['password'],
      message: 'required',
    })
  })
})
