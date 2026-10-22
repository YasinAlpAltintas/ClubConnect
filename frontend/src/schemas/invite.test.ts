import { describe, expect, it } from 'vitest'
import { inviteCodeSchema } from './invite'

describe('inviteCodeSchema', () => {
  it('validates a correct 6-digit code', () => {
    const result = inviteCodeSchema.safeParse({ code: '123456' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('123456')
    }
  })

  it('preserves leading zeros in 6-digit codes', () => {
    const result = inviteCodeSchema.safeParse({ code: '004921' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('004921')
    }
  })

  it('trims leading and trailing whitespace', () => {
    const result = inviteCodeSchema.safeParse({ code: '  012345  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('012345')
    }
  })

  it('rejects an empty code', () => {
    const result = inviteCodeSchema.safeParse({ code: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('required')
    }
  })

  it('rejects codes shorter than 6 digits', () => {
    const result = inviteCodeSchema.safeParse({ code: '12345' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('exact_six_digits')
    }
  })

  it('rejects codes longer than 6 digits', () => {
    const result = inviteCodeSchema.safeParse({ code: '1234567' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('exact_six_digits')
    }
  })

  it('rejects codes with non-numeric characters', () => {
    const result = inviteCodeSchema.safeParse({ code: '12345a' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('numeric_only')
    }
  })

  it('rejects letters and special symbols', () => {
    const result = inviteCodeSchema.safeParse({ code: 'ABC-12' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('numeric_only')
    }
  })
})
