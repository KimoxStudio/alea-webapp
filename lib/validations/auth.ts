import { z } from 'zod'

const PASSWORD_LOWERCASE_REGEX = /[a-z]/
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/
const PASSWORD_NUMBER_REGEX = /[0-9]/
const PASSWORD_ALPHANUMERIC_REGEX = /^[A-Za-z0-9]+$/
const PASSWORD_MIN_LENGTH = 8

export type PasswordRequirementKey = 'minLength' | 'lowercase' | 'uppercase' | 'number' | 'alphanumeric'

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'errors.passwordMinLength')
  .max(1024, 'errors.passwordMaxLength')
  .regex(PASSWORD_LOWERCASE_REGEX, 'errors.passwordLowercase')
  .regex(PASSWORD_UPPERCASE_REGEX, 'errors.passwordUppercase')
  .regex(PASSWORD_NUMBER_REGEX, 'errors.passwordNumber')
  .regex(PASSWORD_ALPHANUMERIC_REGEX, 'errors.passwordAlphanumericOnly')

export function getPasswordRequirementChecks(password: string): Array<{
  key: PasswordRequirementKey
  passed: boolean
}> {
  return [
    { key: 'minLength', passed: password.length >= PASSWORD_MIN_LENGTH },
    { key: 'lowercase', passed: PASSWORD_LOWERCASE_REGEX.test(password) },
    { key: 'uppercase', passed: PASSWORD_UPPERCASE_REGEX.test(password) },
    { key: 'number', passed: PASSWORD_NUMBER_REGEX.test(password) },
    { key: 'alphanumeric', passed: PASSWORD_ALPHANUMERIC_REGEX.test(password) },
  ]
}

export const loginSchema = z.object({
  identifier: z.string().min(1, 'errors.memberNumberRequired'),
  password: z.string().min(1, 'errors.passwordRequired').max(1024, 'errors.passwordMaxLength'),
})

export const memberNumberSchema = z
  .string()
  .min(1, 'errors.memberNumberRequired')
  .max(10, 'errors.memberNumberTooLong')
  .regex(/^\d+$/, 'errors.memberNumberNumeric')

export const registerSchema = z
  .object({
    memberNumber: memberNumberSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'errors.passwordsDoNotMatch',
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

export const activationSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'errors.passwordsDoNotMatch',
    path: ['confirmPassword'],
  })

export const activationServerSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export const recoveryServerSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type RegisterServerData = z.infer<typeof registerServerSchema>
export type ActivationFormData = z.infer<typeof activationSchema>
export type RecoveryFormData = ActivationFormData
