'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginFormProps { locale: string }

export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations('auth')
  const { login } = useAuth()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    try {
      await login(data.identifier, data.password)
      router.push(`/${locale}/rooms`)
    } catch {
      setServerError(t('errors.invalidCredentials'))
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
        <Label htmlFor="identifier">{t('memberOrEmail')}</Label>
        <Input
          id="identifier" type="text" autoComplete="username"
          placeholder="123456 o nombre@email.com"
          aria-describedby={errors.identifier ? 'identifier-error' : undefined}
          aria-invalid={!!errors.identifier}
          {...register('identifier')}
        />
        {errors.identifier && (
          <p id="identifier-error" role="alert" className="text-xs text-destructive">
            {t(errors.identifier.message as Parameters<typeof t>[0])}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <div className="relative">
          <Input
            id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
            className="pr-10"
            aria-describedby={errors.password ? 'password-error' : undefined}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          <button
            type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" role="alert" className="text-xs text-destructive">
            {t(errors.password.message as Parameters<typeof t>[0])}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('login')}...</> : t('login')}
      </Button>
    </form>
  )
}
