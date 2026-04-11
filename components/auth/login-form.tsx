'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DiceLoader } from '@/components/ui/dice-loader'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFormField,
} from '@/components/ui/form'

function TranslatedFormMessage({ message }: { message: string | undefined }) {
  const { formMessageId } = useFormField()
  const tField = useTranslations('auth')
  if (!message) return null
  return (
    <p id={formMessageId} role="alert" className="text-xs text-destructive">
      {tField(message as Parameters<typeof tField>[0])}
    </p>
  )
}

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
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && (
          <div role="alert" className="rounded-md bg-destructive/15 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('memberNumber')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="username"
                  placeholder={t('identifierPlaceholder')}
                  {...field}
                />
              </FormControl>
              <TranslatedFormMessage message={form.formState.errors.identifier?.message} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <TranslatedFormMessage message={form.formState.errors.password?.message} />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? (
              <span className="inline-flex items-center gap-2">
                <DiceLoader size="sm" />
                <span>{t('login')}...</span>
              </span>
            )
            : t('login')}
        </Button>
      </form>
    </Form>
  )
}
