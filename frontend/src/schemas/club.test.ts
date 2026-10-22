import { describe, expect, it } from 'vitest'
import { createClubSchema } from './club'

describe('createClubSchema', () => {
  it('accepts a valid club name and description', () => {
    const result = createClubSchema.safeParse({
      name: 'Leuven Coding Society',
      description: 'Campus software engineering community',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Leuven Coding Society')
      expect(result.data.description).toBe('Campus software engineering community')
    }
  })

  it('trims leading and trailing whitespace from name', () => {
    const result = createClubSchema.safeParse({
      name: '  Robotics Club  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Robotics Club')
      expect(result.data.description).toBeUndefined()
    }
  })

  it('rejects an empty name with required error', () => {
    const result = createClubSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('required')
    }
  })

  it('rejects a whitespace-only name with required error', () => {
    const result = createClubSchema.safeParse({ name: '    ' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('required')
    }
  })

  it('rejects a 1-character name with name_min error', () => {
    const result = createClubSchema.safeParse({ name: 'A' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('name_min')
    }
  })

  it('rejects a name exceeding 100 characters with name_max error', () => {
    const result = createClubSchema.safeParse({ name: 'x'.repeat(101) })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('name_max')
    }
  })

  it('rejects a description exceeding 500 characters with desc_max error', () => {
    const result = createClubSchema.safeParse({
      name: 'Valid Club',
      description: 'd'.repeat(501),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('desc_max')
    }
  })
})
