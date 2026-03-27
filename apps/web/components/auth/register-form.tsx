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
import { Label } from '@/components/ui/label'

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
            ? <Check className="h-3 w-3 text-emerald flex-shrink-0" aria-hidden="true" />
            : <X className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />}
          <span className={check.passed ? 'text-emerald-light' : 'text-muted-foreground'}>{check.label}</span>
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const passwordValue = watch('password', '')

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)
    try {
      await registerUser(data.memberNumber, data.email, data.password)
      router.push(`/${locale}/rooms`)
    } catch (err: unknown) {
      const error = err as { message?: string }
      setServerError(error?.message ?? t('errors.invalidCredentials'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && (
        <div role="alert" className="rounded-md bg-destructive/15 border border-destructive/30 px-4 py-3 text-sm text-destructive-foreground">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="memberNumber">{t('memberNumber')}</Label>
        <Input id="memberNumber" type="text" placeholder="123456"
          aria-describedby={errors.memberNumber ? 'memberNumber-error' : undefined}
          aria-invalid={!!errors.memberNumber}
          {...register('memberNumber')}
        />
        {errors.memberNumber && <p id="memberNumber-error" role="alert" className="text-xs text-destructive">{t(errors.memberNumber.message as Parameters<typeof t>[0])}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="nombre@email.com"
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && <p id="email-error" role="alert" className="text-xs text-destructive">{t(errors.email.message as Parameters<typeof t>[0])}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-password">{t('password')}</Label>
        <div className="relative">
          <Input id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
            className="pr-10"
            aria-describedby="password-requirements"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}>
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <div id="password-requirements"><PasswordStrengthIndicator password={passwordValue} /></div>
        {errors.password && <p role="alert" className="text-xs text-destructive">{t(errors.password.message as Parameters<typeof t>[0])}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <div className="relative">
          <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
            className="pr-10"
            aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={showConfirm ? 'Ocultar confirmacion' : 'Mostrar confirmacion'}>
            {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {errors.confirmPassword && <p id="confirm-error" role="alert" className="text-xs text-destructive">{t(errors.confirmPassword.message as Parameters<typeof t>[0])}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('register')}...</> : t('register')}
      </Button>
    </form>
  )
}
