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
  identifier: z.string().min(1, 'auth.errors.memberOrEmailRequired'),
  password: z.string().min(1, 'auth.errors.passwordRequired').max(1024, 'auth.errors.passwordMaxLength'),
})

export const registerSchema = z
  .object({
    memberNumber: z.string().min(1, 'auth.errors.memberNumberRequired'),
    email: z.string().email('auth.errors.emailInvalid'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.errors.passwordsDoNotMatch',
    path: ['confirmPassword'],
  })

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
