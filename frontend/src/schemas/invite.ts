import { z } from 'zod'

export const inviteCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'required')
    .length(6, 'exact_six_digits')
    .regex(/^\d{6}$/, 'numeric_only'),
})

export type InviteCodeInput = z.infer<typeof inviteCodeSchema>
