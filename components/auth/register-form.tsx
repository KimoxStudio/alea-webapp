'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, X, Loader2, BadgeIcon, LockKeyhole } from 'lucide-react'
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'

function PasswordStrengthIndicator({ password }: { password: string }) {
  const checks = [
    { label: 'Minimo 12 caracteres', passed: password.length >= 12 },
    { label: 'Letras y numeros', passed: /[a-zA-Z]/.test(password) && /[0-9]/.test(password) },
    { label: 'Simbolo especial', passed: /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(password) },
  ]

  return (
    <ul className="mt-2 space-y-1" aria-label="Requisitos de contrasena">
      {checks.map((check) => (
        <li key={check.label} className="flex items-center gap-2 text-xs">
          {check.passed
            ? <Check className="h-3 w-3 flex-shrink-0 text-primary" aria-hidden="true" />
            : <X className="h-3 w-3 flex-shrink-0 text-on-surface-variant" aria-hidden="true" />}
          <span className={check.passed ? 'text-primary' : 'text-on-surface-variant'}>{check.label}</span>
          <span className="sr-only">{check.passed ? '(cumplido)' : '(pendiente)'}</span>
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
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const passwordValue = watch('password', '')

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)
    try {
      await registerUser(data.memberNumber, data.password)
      router.push(`/${locale}/rooms`)
    } catch (err: unknown) {
      const error = err as { message?: string }
      setServerError(error?.message ?? t('errors.invalidCredentials'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 w-full">
      {serverError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/15 px-4 py-3 text-sm text-destructive-foreground">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="memberNumber" className="text-[10px] uppercase tracking-[0.2em] font-bold ml-1 text-outline">
          {t('memberNumber')}
        </Label>
        <div className="relative">
          <BadgeIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" aria-hidden="true" />
          <Input
            id="memberNumber"
            type="text"
            placeholder="123456"
            className="border-0 border-b-2 border-outline-variant bg-surface-container-low py-4 pl-12 pr-4 text-base text-on-surface placeholder:text-surface-variant focus-visible:border-primary focus-visible:ring-0"
            aria-describedby={errors.memberNumber ? 'memberNumber-error' : undefined}
            aria-invalid={!!errors.memberNumber}
            {...register('memberNumber')}
          />
        </div>
        {errors.memberNumber && <p id="memberNumber-error" role="alert" className="text-xs text-destructive">{t(errors.memberNumber.message as Parameters<typeof t>[0])}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-password" className="text-[10px] uppercase tracking-[0.2em] font-bold ml-1 text-outline">
          {t('password')}
        </Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary/70" aria-hidden="true" />
          <PasswordInput
            id="reg-password"
            autoComplete="new-password"
            className="border-0 border-b-2 border-outline-variant bg-surface-container-low py-4 pl-12 pr-12 text-base text-on-surface placeholder:text-surface-variant focus-visible:border-primary focus-visible:ring-0"
            aria-describedby="password-requirements"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </div>
        <div id="password-requirements"><PasswordStrengthIndicator password={passwordValue} /></div>
        {errors.password && <p role="alert" className="text-xs text-destructive">{t(errors.password.message as Parameters<typeof t>[0])}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-[10px] uppercase tracking-[0.2em] font-bold ml-1 text-outline">
          {t('confirmPassword')}
        </Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary/70" aria-hidden="true" />
          <PasswordInput
            id="confirmPassword"
            variant="confirmation"
            autoComplete="new-password"
            className="border-0 border-b-2 border-outline-variant bg-surface-container-low py-4 pl-12 pr-12 text-base text-on-surface placeholder:text-surface-variant focus-visible:border-primary focus-visible:ring-0"
            aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </div>
        {errors.confirmPassword && <p id="confirm-error" role="alert" className="text-xs text-destructive">{t(errors.confirmPassword.message as Parameters<typeof t>[0])}</p>}
      </div>

      <div className="border-0 border-l-2 border-primary bg-surface-container-low p-4 text-sm text-on-surface-variant">
        {t('passwordRequirements')}
      </div>

      <Button
        type="submit"
        variant="outline"
        className="w-full border-2 border-primary bg-transparent font-bold uppercase tracking-[0.3em] text-primary hover:bg-primary/10 py-5"
        disabled={isSubmitting}
      >
        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('register')}...</> : t('register')}
      </Button>
    </form>
  )
}
