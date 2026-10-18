import { z } from 'zod'

export const registerSchema = z.object({
  email: z
    .string({ error: 'required' })
    .min(1, 'required')
    .max(254, 'email_invalid')
    .regex(/^[^@\s]+@[^@\s]+$/, 'email_invalid'),
  password: z
    .string({ error: 'required' })
    .min(8, 'password_min')
    .regex(/[A-Za-z]/, 'password_letter')
    .regex(/[0-9]/, 'password_digit'),
})

export type RegisterInput = z.infer<typeof registerSchema>
