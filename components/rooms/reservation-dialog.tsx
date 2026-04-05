'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, Clock3, Layers, Loader2 } from 'lucide-react'
import type { GameTable, TableSurface } from '@/lib/types'
import { useTableAvailability, useCreateReservation } from '@/lib/hooks/use-reservations'
import { generateTimeSlots, formatDate, cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface ReservationDialogProps {
  table: GameTable | null
  open: boolean
  onClose: () => void
}

export function ReservationDialog({ table, open, onClose }: ReservationDialogProps) {
  const t = useTranslations('reservations')
  const tTables = useTranslations('tables')
  const tCommon = useTranslations('common')

  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null)
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [selectedSurface, setSelectedSurface] = useState<TableSurface | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { data: availability, isLoading: availabilityLoading } = useTableAvailability(table?.id ?? null, selectedDate)
  const createReservation = useCreateReservation()

  const timeSlots = generateTimeSlots('09:00', '22:00', 180)

  function resetState() {
    setSelectedDate(today)
    setSelectedStartTime(null)
    setSelectedEndTime(null)
    setSelectedSurface(null)
    setError(null)
    setSuccess(false)
  }

  function isSlotAvailable(time: string, surface?: TableSurface) {
    if (!availability) return true
    if (table?.type === 'removable_top' && surface) {
      const slots = surface === 'top' ? availability.top : availability.bottom
      return slots?.find((slot) => slot.startTime === time)?.available ?? true
    }
    return availability.slots.find((slot) => slot.startTime === time)?.available ?? true
  }

  async function handleSubmit() {
    if (!table || !selectedStartTime || !selectedEndTime) return
    if (table.type === 'removable_top' && !selectedSurface) {
      setError(tTables('surfaceConflict'))
      return
    }

    setError(null)

    try {
      await createReservation.mutateAsync({
        tableId: table.id,
        date: selectedDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        surface: table.type === 'removable_top' ? selectedSurface ?? undefined : undefined,
      })
      setSuccess(true)
      setTimeout(() => {
        onClose()
        resetState()
      }, 1200)
    } catch {
      setError(t('errors.conflictTime'))
    }
  }

  if (!table) return null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        onClose()
        resetState()
      }
    }}>
      <DialogContent className="max-w-3xl border border-outline-variant/15 bg-surface-container-high/95 p-0 shadow-2xl shadow-black/40">
        <DialogHeader className="rounded-t-[1.5rem] bg-[radial-gradient(circle_at_top,_rgba(255,183,123,0.18),_transparent_48%),linear-gradient(135deg,_rgba(53,53,52,0.96),_rgba(19,19,19,0.98))] px-6 py-6 sm:px-8">
          <DialogTitle className="font-cinzel text-3xl text-foreground">
            {t('makeReservation')} · {table.name}
          </DialogTitle>
          <DialogDescription className="mt-2 text-on-surface-variant">
            {tTables(table.type)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reservation-date" className="text-[11px] uppercase tracking-[0.28em] text-primary/80">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('selectDate')}
                </span>
              </Label>
              <input
                id="reservation-date"
                type="date"
                value={selectedDate}
                min={today}
                onChange={(event) => {
                  setSelectedDate(event.target.value)
                  setSelectedStartTime(null)
                  setSelectedEndTime(null)
                }}
                className="h-14 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-on-surface-variant">{formatDate(selectedDate)}</p>
            </div>

            {table.type === 'removable_top' && (
              <div className="space-y-3">
                <Label className="text-[11px] uppercase tracking-[0.28em] text-primary/80">
                  <span className="inline-flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                    {tTables('selectSurface')}
                  </span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['top', 'bottom'] as TableSurface[]).map((surface) => {
                    const slots = surface === 'top' ? availability?.top : availability?.bottom
                    const occupied = slots?.some((slot) => !slot.available)

                    return (
                      <button
                        key={surface}
                        type="button"
                        onClick={() => {
                          setSelectedSurface(surface)
                          setSelectedStartTime(null)
                          setSelectedEndTime(null)
                        }}
                        className={cn(
                          'rounded-xl border px-4 py-4 text-left transition-all',
                          selectedSurface === surface
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-outline-variant/20 bg-surface-container-low text-foreground hover:border-primary/30',
                        )}
                      >
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em]">
                          {surface === 'top' ? tTables('surfaceTop') : tTables('surfaceBottom')}
                        </p>
                        <p className={cn('mt-2 text-xs', selectedSurface === surface ? 'text-on-primary/80' : occupied ? 'text-primary-container' : 'text-primary')}>
                          {occupied ? t('occupied') : t('available')}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-[11px] uppercase tracking-[0.28em] text-primary/80">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('selectTime')}
                </span>
              </Label>

              {availabilityLoading ? (
                <div className="flex h-32 items-center justify-center rounded-xl bg-surface-container-low text-sm text-on-surface-variant">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {tCommon('loading')}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {timeSlots.map((startTime, index) => {
                    const endTime = timeSlots[index + 1] ?? '22:00'
                    const available = isSlotAvailable(startTime, selectedSurface ?? undefined)
                    const selected = selectedStartTime === startTime && selectedEndTime === endTime

                    return (
                      <button
                        key={startTime}
                        type="button"
                        disabled={!available || index === timeSlots.length - 1}
                        onClick={() => {
                          setSelectedStartTime(startTime)
                          setSelectedEndTime(endTime)
                        }}
                        className={cn(
                          'rounded-xl border px-4 py-3 text-left transition-all',
                          !available || index === timeSlots.length - 1
                            ? 'cursor-not-allowed border-outline-variant/15 bg-surface-container-lowest text-outline opacity-40'
                            : selected
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-outline-variant/15 bg-surface-container-low hover:border-primary/30 hover:bg-surface-container',
                        )}
                      >
                        <p className="text-xs uppercase tracking-[0.22em]">
                          {startTime} - {endTime}
                        </p>
                        <p className={cn('mt-2 text-[11px]', selected ? 'text-on-primary/80' : available ? 'text-primary' : 'text-outline')}>
                          {available ? t('available') : t('occupied')}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4 rounded-[1.5rem] bg-surface-container-low p-5">
            <div className="rounded-xl bg-surface-container p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-primary/70">Summary</p>
              <dl className="mt-4 space-y-3 text-sm text-on-surface-variant">
                <div className="flex items-center justify-between gap-3">
                  <dt>{t('selectDate')}</dt>
                  <dd className="text-foreground">{formatDate(selectedDate)}</dd>
                </div>
                {selectedSurface && (
                  <div className="flex items-center justify-between gap-3">
                    <dt>{tTables('surface')}</dt>
                    <dd className="text-foreground">
                      {selectedSurface === 'top' ? tTables('surfaceTop') : tTables('surfaceBottom')}
                    </dd>
                  </div>
                )}
                {selectedStartTime && selectedEndTime && (
                  <div className="flex items-center justify-between gap-3">
                    <dt>{t('selectTime')}</dt>
                    <dd className="text-foreground">{selectedStartTime} - {selectedEndTime}</dd>
                  </div>
                )}
              </dl>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {error}
              </div>
            )}

            {success && (
              <div role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                Reserva confirmada.
              </div>
            )}
          </aside>
        </div>

        <DialogFooter className="border-t border-outline-variant/10 px-6 py-5 sm:px-8">
          <Button variant="outline" onClick={() => {
            onClose()
            resetState()
          }}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              createReservation.isPending ||
              !selectedStartTime ||
              !selectedEndTime ||
              (table.type === 'removable_top' && !selectedSurface)
            }
            className="bg-primary hover:bg-primary"
          >
            {createReservation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{tCommon('loading')}</>
              : t('makeReservation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
