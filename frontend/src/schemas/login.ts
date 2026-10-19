import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string({ error: 'required' })
    .min(1, 'required')
    .max(254, 'email_invalid')
    .regex(/^[^@\s]+@[^@\s]+$/, 'email_invalid'),
  password: z
    .string({ error: 'required' })
    .min(1, 'required'),
})

export type LoginInput = z.infer<typeof loginSchema>
