import { describe, expect, it } from 'vitest'
import { registerSchema } from './register'

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'you@example.com',
      password: 'Secret12',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing email with the required key', () => {
    const result = registerSchema.safeParse({ email: '', password: 'Secret12' })
    if (result.success) throw new Error('expected failure')
    expect(result.error.issues[0]).toMatchObject({ path: ['email'], message: 'required' })
  })

  it('rejects a malformed email with the email_invalid key', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'Secret12',
    })
    if (result.success) throw new Error('expected failure')
    expect(result.error.issues[0]).toMatchObject({
      path: ['email'],
      message: 'email_invalid',
    })
  })

  it('rejects a too-long email with the email_invalid key', () => {
    const result = registerSchema.safeParse({
      email: `${'a'.repeat(255)}@example.com`,
      password: 'Secret12',
    })
    if (result.success) throw new Error('expected failure')
    expect(result.error.issues[0]?.message).toBe('email_invalid')
  })

  it('rejects a short password with the password_min key', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: 'a1b',
    })
    if (result.success) throw new Error('expected failure')
    expect(result.error.issues[0]).toMatchObject({
      path: ['password'],
      message: 'password_min',
    })
  })

  it('rejects a password without a letter', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: '12345678',
    })
    if (result.success) throw new Error('expected failure')
    expect(result.error.issues[0]?.message).toBe('password_letter')
  })

  it('rejects a password without a digit', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: 'abcdefgh',
    })
    if (result.success) throw new Error('expected failure')
    expect(result.error.issues[0]?.message).toBe('password_digit')
  })

  it('accepts an 8-character password with a letter and a digit', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: 'a1234567',
    })
    expect(result.success).toBe(true)
  })
})
