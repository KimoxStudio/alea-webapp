'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLocale } from 'next-intl'

export type CheckInStatus =
  | 'activated'
  | 'already_active'
  | 'too_early'
  | 'too_late'
  | 'no_reservation'
  | 'error'

interface CheckInResultProps {
  status: CheckInStatus
}

export function CheckInResult({ status }: CheckInResultProps) {
  const t = useTranslations('checkin')
  const locale = useLocale()
  const router = useRouter()

  const isSuccess = status === 'activated' || status === 'already_active'
  const isTransient = status === 'too_early' || status === 'error'

  function getIcon() {
    switch (status) {
      case 'activated':
      case 'already_active':
        return <CheckCircle className="h-12 w-12 text-green-500" aria-hidden="true" />
      case 'too_early':
      case 'too_late':
        return <Clock className="h-12 w-12 text-amber-400" aria-hidden="true" />
      case 'no_reservation':
        return <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
      default:
        return <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
    }
  }

  function getMessage() {
    switch (status) {
      case 'activated':
        return t('activated')
      case 'already_active':
        return t('alreadyActive')
      case 'too_early':
        return t('tooEarly')
      case 'too_late':
        return t('tooLate')
      case 'no_reservation':
        return t('noReservation')
      case 'error':
        return t('error')
      default:
        return t('error')
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 pt-8 pb-8">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-background-secondary/60 border border-border/50">
            {getIcon()}
          </div>

          <div className="text-center space-y-2">
            <h1 className="font-cinzel text-xl font-semibold text-foreground">
              {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getMessage()}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            {isSuccess && (
              <Button
                asChild
                className="w-full"
              >
                <a href={`/${locale}/reservations`}>
                  {t('backToReservations')}
                </a>
              </Button>
            )}
            {isTransient && (
              <Button
                variant="outline"
                className="w-full border-border"
                onClick={() => router.refresh()}
              >
                {t('tryAgain')}
              </Button>
            )}
            {!isSuccess && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => router.push(`/${locale}/reservations`)}
              >
                {t('backToReservations')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
