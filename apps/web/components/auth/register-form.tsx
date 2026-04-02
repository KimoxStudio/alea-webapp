'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

function PasswordStrengthIndicator({ password }: { password: string }) {
  const t = useTranslations('auth')
  const checks = [
    { key: 'minChars', label: t('requireMinChars'), passed: password.length >= 12 },
    { key: 'lettersNumbers', label: t('requireLettersNumbers'), passed: /[a-zA-Z]/.test(password) && /[0-9]/.test(password) },
    { key: 'specialChar', label: t('requireSpecialChar'), passed: /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(password) },
  ]
  return (
    <ul className="mt-2 space-y-1" aria-label={t('passwordRequirementsLabel')}>
      {checks.map((check) => (
        <li key={check.key} className="flex items-center gap-2 text-xs">
          {check.passed
            ? <Check className="h-3 w-3 text-emerald flex-shrink-0" aria-hidden="true" />
            : <X className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />}
          <span className={check.passed ? 'text-emerald-light' : 'text-muted-foreground'}>{check.label}</span>
          <span className="sr-only">{check.passed ? t('requirementMet') : t('requirementPending')}</span>
        </li>
      ))}
    </ul>
  )
}

interface RegisterFormProps { locale: string }

export function RegisterForm({ locale }: RegisterFormProps) {
  const t = useTranslations('auth')
  const { register: registerUser } = useAuth()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      memberNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const { isSubmitting } = form.formState
  const passwordValue = form.watch('password', '')

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)
    try {
      await registerUser(data.memberNumber, data.email, data.password)
      router.push(`/${locale}/rooms`)
    } catch {
      setServerError(t('errors.invalidCredentials'))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && (
          <div role="alert" className="rounded-md bg-destructive/15 border border-destructive/30 px-4 py-3 text-sm text-destructive-foreground">
            {serverError}
          </div>
        )}

        <FormField
          control={form.control}
          name="memberNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('memberNumber')}</FormLabel>
              <FormControl>
                <Input type="text" placeholder="123456" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@email.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    {...field}
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <FormDescription>
                <PasswordStrengthIndicator password={passwordValue} />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('confirmPassword')}</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    {...field}
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label={showConfirm ? t('hideConfirmation') : t('showConfirmation')}
                >
                  {showConfirm
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('register')}...</>
            : t('register')}
        </Button>
      </form>
    </Form>
  )
}
