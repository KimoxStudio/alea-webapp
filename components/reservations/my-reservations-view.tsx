'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarDays, Clock, MapPin, Layers, AlertCircle } from 'lucide-react'
import { DiceLoader } from '@/components/ui/dice-loader'
import { useAuth } from '@/lib/auth/auth-context'
import { useMyReservations, useCancelReservation } from '@/lib/hooks/use-reservations'
import { formatDate, formatTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import type { Reservation } from '@/lib/types'

const statusBadgeVariant: Record<Reservation['status'], 'available' | 'reserved' | 'outline'> = {
  active: 'available',
  cancelled: 'reserved',
  completed: 'outline',
  pending: 'outline',
  no_show: 'reserved',
}

interface ReservationCardProps {
  reservation: Reservation
  onCancel: (id: string) => void
}

function ReservationCard({ reservation, onCancel }: ReservationCardProps) {
  const t = useTranslations('reservations')
  const tt = useTranslations('tables')
  return (
    <div className="rpg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span>
              {reservation.roomName && reservation.tableName
                ? `${reservation.roomName} · ${reservation.tableName}`
                : reservation.tableName ?? reservation.tableId}
            </span>
            {reservation.surface && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Layers className="h-3 w-3" aria-hidden="true" />
                {reservation.surface === 'top' ? tt('surfaceTop') : tt('surfaceBottom')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDate(reservation.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatTime(reservation.startTime)} — {formatTime(reservation.endTime)}
            </span>
          </div>
        </div>
        <Badge variant={statusBadgeVariant[reservation.status]}>
          {t(reservation.status)}
        </Badge>
      </div>

      {reservation.status === 'active' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCancel(reservation.id)}
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/15"
        >
          {t('cancel')}
        </Button>
      )}
    </div>
  )
}

export function MyReservationsView() {
  const t = useTranslations('reservations')
  const { user } = useAuth()
  const { data: reservations, isLoading } = useMyReservations(user?.id ?? null)
  const cancelReservation = useCancelReservation()
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const closeDialog = () => {
    setCancelingId(null)
    setCancelError(null)
  }

  const activeReservations = reservations?.filter(r => r.status === 'active') ?? []
  const pastReservations = reservations?.filter(r => r.status !== 'active') ?? []

  async function handleCancel(id: string) {
    setCancelError(null)
    try {
      await cancelReservation.mutateAsync(id)
      closeDialog()
    } catch (error: unknown) {
      const msg = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? ''
      if (msg === 'CANCELLATION_CUTOFF') {
        setCancelError(t('errors.cancellationCutoff'))
      } else {
        setCancelError(t('errors.generic'))
      }
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CalendarDays className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="font-cinzel text-2xl font-bold text-gradient-gold">{t('title')}</h1>
        </div>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active reservations */}
          <section aria-labelledby="active-reservations-heading">
            <h2 id="active-reservations-heading" className="font-cinzel text-lg font-semibold mb-4 text-foreground">
              {t('active')} ({activeReservations.length})
            </h2>
            {activeReservations.length === 0 ? (
              <div className="rpg-card p-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <p className="text-muted-foreground">{t('noReservations')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeReservations.map(r => <ReservationCard key={r.id} reservation={r} onCancel={setCancelingId} />)}
              </div>
            )}
          </section>

          {/* Past reservations */}
          {pastReservations.length > 0 && (
            <section aria-labelledby="past-reservations-heading">
              <h2 id="past-reservations-heading" className="font-cinzel text-lg font-semibold mb-4 text-muted-foreground">
                {t('completed')} / {t('cancelled')} ({pastReservations.length})
              </h2>
              <div className="space-y-3 opacity-70">
                {pastReservations.map(r => <ReservationCard key={r.id} reservation={r} onCancel={setCancelingId} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelingId} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cinzel">{t('cancel')}</DialogTitle>
            <DialogDescription>{t('cancelConfirm')}</DialogDescription>
          </DialogHeader>
          {cancelError && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {cancelError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelingId && handleCancel(cancelingId)}
              disabled={cancelReservation.isPending}
            >
              {cancelReservation.isPending
                ? <span className="inline-flex items-center gap-2"><DiceLoader size="sm" hideRole /><span>{t('canceling')}</span></span>
                : t('confirmCancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
