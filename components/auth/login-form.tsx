'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Loader2, BadgeIcon, LockKeyhole, ShieldCheck } from 'lucide-react'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface LoginFormProps { locale: string }

export function LoginForm({ locale }: LoginFormProps) {
  const t = useTranslations('auth')
  const { login } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  })

  const { isSubmitting } = form.formState

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {serverError && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {serverError}
          </div>
        )}

        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-[11px] uppercase tracking-[0.25em] text-outline">
                {t('memberNumber')}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <BadgeIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" aria-hidden="true" />
                  <Input
                    type="text"
                    autoComplete="username"
                    placeholder={t('identifierPlaceholder')}
                    className="h-14 border-0 border-b-2 border-outline-variant bg-surface-container-low pl-12 pr-4 text-base text-foreground placeholder:text-outline focus-visible:ring-0 focus-visible:border-primary rounded-none"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-[11px] uppercase tracking-[0.25em] text-outline">
                {t('password')}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary/70" aria-hidden="true" />
                  <PasswordInput
                    autoComplete="current-password"
                    className="h-14 border-0 border-b-2 border-outline-variant bg-surface-container-low pl-12 pr-12 text-base text-foreground placeholder:text-outline focus-visible:ring-0 focus-visible:border-primary rounded-none"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-3">
            <Checkbox aria-label={t('rememberMe')} />
            <span>{t('rememberMe')}</span>
          </label>
          <Link
            href={`/${locale}/login`}
            className="text-primary/80 transition-colors hover:text-primary"
          >
            {t('forgotPassword')}
          </Link>
        </div>

        <Button
          type="submit"
          className="h-14 w-full rounded-md bg-primary font-bold uppercase tracking-[0.3em] text-on-primary transition-transform hover:-translate-y-0.5"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('login')}...</>
            : t('login')}
        </Button>

        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em]">
              {t('accessNoteTitle')}
            </span>
          </div>
          <p className="mt-2 leading-relaxed">{t('accessNoteBody')}</p>
        </div>
      </form>
    </Form>
  )
}
