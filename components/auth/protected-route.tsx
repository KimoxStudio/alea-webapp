'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { DiceLoader } from '@/components/ui/dice-loader'

interface ProtectedRouteProps {
  children: React.ReactNode
  locale: string
}

export function ProtectedRoute({ children, locale }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const t = useTranslations('auth')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/${locale}/login`)
    }
  }, [isLoading, isAuthenticated, router, locale])

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <DiceLoader size="lg" label={t('verifyingSession')} />
          <p className="text-sm text-muted-foreground font-cinzel" aria-hidden="true">{t('verifyingSession')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
