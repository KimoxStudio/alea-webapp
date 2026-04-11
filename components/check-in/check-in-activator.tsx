'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckInResult } from '@/components/check-in/check-in-result'
import type { CheckInStatus } from '@/components/check-in/check-in-result'

interface CheckInActivatorProps {
  tableId: string
  side?: string
}

export function CheckInActivator({ tableId, side }: CheckInActivatorProps) {
  const t = useTranslations('checkin')
  const [status, setStatus] = useState<CheckInStatus | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const url = `/api/tables/${encodeURIComponent(tableId)}/activate${side === 'inf' ? '?side=inf' : ''}`

    fetch(url, { method: 'POST', signal: controller.signal })
      .then(async (res) => {
        if (res.ok) {
          setStatus('activated')
          return
        }
        const body = await res.json().catch(() => ({}))
        const msg: string = body?.message ?? ''
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
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('error')
      })

    return () => controller.abort()
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
