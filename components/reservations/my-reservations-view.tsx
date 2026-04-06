'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarDays, Clock, MapPin, Layers, Loader2, AlertCircle } from 'lucide-react'
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

export function MyReservationsView() {
  const t = useTranslations('reservations')
  const { user } = useAuth()
  const { data: reservations, isLoading } = useMyReservations(user?.id ?? null)
  const cancelReservation = useCancelReservation()
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const activeReservations = reservations?.filter(r => r.status === 'active') ?? []
  const pastReservations = reservations?.filter(r => r.status !== 'active') ?? []

  async function handleCancel(id: string) {
    try {
      await cancelReservation.mutateAsync(id)
    } finally {
      setCancelingId(null)
    }
  }

  const statusBadgeVariant: Record<Reservation['status'], 'available' | 'reserved' | 'outline'> = {
    active: 'available',
    cancelled: 'reserved',
    completed: 'outline',
  }

  function ReservationCard({ reservation }: { reservation: Reservation }) {
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
                  {reservation.surface === 'top' ? 'Superior' : 'Inferior'}
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
            onClick={() => setCancelingId(reservation.id)}
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/15"
          >
            {t('cancel')}
          </Button>
        )}
      </div>
    )
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
                {activeReservations.map(r => <ReservationCard key={r.id} reservation={r} />)}
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
                {pastReservations.map(r => <ReservationCard key={r.id} reservation={r} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelingId} onOpenChange={() => setCancelingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cinzel">{t('cancel')}</DialogTitle>
            <DialogDescription>{t('cancelConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelingId(null)}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelingId && handleCancel(cancelingId)}
              disabled={cancelReservation.isPending}
            >
              {cancelReservation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Cancelando...</>
                : 'Si, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
