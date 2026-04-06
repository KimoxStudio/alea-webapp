import { z } from 'zod'

const PASSWORD_SPECIAL_CHARS = /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/

export const passwordSchema = z
  .string()
  .min(12, 'auth.errors.passwordMinLength')
  .max(1024, 'auth.errors.passwordMaxLength')
  .regex(/[a-zA-Z]/, 'auth.errors.passwordAlphanumeric')
  .regex(/[0-9]/, 'auth.errors.passwordAlphanumeric')
  .regex(PASSWORD_SPECIAL_CHARS, 'auth.errors.passwordSpecialChar')

export const loginSchema = z.object({
  identifier: z.string().min(1, 'auth.errors.memberNumberRequired'),
  password: z.string().min(1, 'auth.errors.passwordRequired').max(1024, 'auth.errors.passwordMaxLength'),
})

const memberNumberSchema = z
  .string()
  .min(1, 'auth.errors.memberNumberRequired')
  .max(20, 'auth.errors.memberNumberTooLong')
  .regex(/^\d+$/, 'auth.errors.memberNumberNumeric')

export const registerSchema = z
  .object({
    memberNumber: memberNumberSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.errors.passwordsDoNotMatch',
    path: ['confirmPassword'],
  })

/**
 * Server-side registration schema: validates the fields sent to the API.
 * confirmPassword is a UI-only concern and is not required server-side.
 */
export const registerServerSchema = z.object({
  memberNumber: memberNumberSchema,
  password: passwordSchema,
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type RegisterServerData = z.infer<typeof registerServerSchema>
