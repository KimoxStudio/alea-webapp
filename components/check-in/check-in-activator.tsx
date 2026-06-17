'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckInResult } from '@/components/check-in/check-in-result'
import type { CheckInStatus } from '@/components/check-in/check-in-result'
import { apiClient } from '@/lib/api/client'

interface CheckInActivatorProps {
  tableId: string
  side?: string
}

export function CheckInActivator({ tableId, side }: CheckInActivatorProps) {
  const t = useTranslations('checkin')
  const [status, setStatus] = useState<CheckInStatus | null>(null)

  useEffect(() => {
    let cancelled = false

    const path = `/tables/${encodeURIComponent(tableId)}/activate${side === 'inf' ? '?side=inf' : ''}`

    apiClient.post(path)
      .then(() => {
        if (!cancelled) setStatus('activated')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg: string = (err as { message?: string })?.message ?? ''
        switch (msg) {
          case 'CHECK_IN_ALREADY_ACTIVE':
            setStatus('already_active')
            break
          case 'CHECK_IN_TOO_EARLY':
            setStatus('too_early')
            break
          case 'CHECK_IN_TOO_LATE':
            setStatus('too_late')
            break
          case 'CHECK_IN_NO_RESERVATION':
            setStatus('no_reservation')
            break
          default:
            setStatus('error')
        }
      })

    return () => { cancelled = true }
  }, [tableId, side])

  if (status === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <p className="text-muted-foreground animate-pulse">{t('loading')}</p>
      </div>
    )
  }

  return <CheckInResult status={status} />
}
