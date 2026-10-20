import { z } from 'zod'

export const createClubSchema = z.object({
  name: z
    .string({ error: 'required' })
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(1, 'required')
        .min(2, 'name_min')
        .max(100, 'name_max'),
    ),
  description: z
    .string()
    .max(500, 'desc_max')
    .optional()
    .transform((val) => (val?.trim() ? val.trim() : undefined)),
})

export type CreateClubInput = z.infer<typeof createClubSchema>
