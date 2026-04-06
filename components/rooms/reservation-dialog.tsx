'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Calendar, Clock, Layers } from 'lucide-react'
import type { GameTable, TableSurface, TableAvailability } from '@/lib/types'
import { useTableAvailability, useCreateReservation } from '@/lib/hooks/use-reservations'
import { useAuth } from '@/lib/auth/auth-context'
import { generateTimeSlots, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
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
  const { user } = useAuth()

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null)
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [selectedSurface, setSelectedSurface] = useState<TableSurface | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { data: availability, isLoading: availabilityLoading } = useTableAvailability(
    table?.id ?? null,
    selectedDate
  )
  const createReservation = useCreateReservation()

  const allTimeSlots = generateTimeSlots('09:00', '22:00', 60)
  const timeSlots = selectedDate === today
    ? allTimeSlots.filter((slot) => {
        const [slotH, slotM] = slot.split(':').map(Number)
        return slotH * 60 + slotM > now.getHours() * 60 + now.getMinutes()
      })
    : allTimeSlots

  function isSlotAvailable(time: string, surface?: TableSurface): boolean {
    if (!availability) return true
    if (table?.type === 'removable_top' && surface) {
      const surfaceSlots = surface === 'top' ? availability.top : availability.bottom
      if (!surfaceSlots) return true
      const slot = surfaceSlots.find(s => s.startTime === time)
      return slot?.available ?? true
    }
    const slot = availability.slots.find(s => s.startTime === time)
    return slot?.available ?? true
  }

  function handleSurfaceSelect(surface: TableSurface) {
    setSelectedSurface(surface)
    setSelectedStartTime(null)
    setSelectedEndTime(null)
  }

  async function handleSubmit() {
    if (!table || !user || !selectedStartTime || !selectedEndTime) return
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
        setSuccess(false)
        onClose()
        setSelectedStartTime(null)
        setSelectedEndTime(null)
        setSelectedSurface(null)
      }, 1500)
    } catch {
      setError(t('errors.conflictTime'))
    }
  }

  function handleClose() {
    setSelectedStartTime(null)
    setSelectedEndTime(null)
    setSelectedSurface(null)
    setError(null)
    setSuccess(false)
    onClose()
  }

  if (!table) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('makeReservation')} — {table.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {tTables(table.type)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Date selector */}
          <div className="space-y-2">
            <Label htmlFor="reservation-date" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {t('selectDate')}
            </Label>
            <input
              id="reservation-date"
              type="date"
              value={selectedDate}
              min={today}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setSelectedStartTime(null)
                setSelectedEndTime(null)
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('selectDate')}
            />
            <p className="text-xs text-muted-foreground">{formatDate(selectedDate)}</p>
          </div>

          {/* Surface selector for removable_top */}
          {table.type === 'removable_top' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {tTables('selectSurface')}
              </Label>
              <div role="radiogroup" aria-label={tTables('selectSurface')} className="grid grid-cols-2 gap-2">
                {(['top', 'bottom'] as TableSurface[]).map((surface) => {
                  const surfaceSlots = surface === 'top' ? availability?.top : availability?.bottom
                  const hasUnavailable = surfaceSlots?.some(s => !s.available)

                  return (
                    <button
                      key={surface}
                      role="radio"
                      aria-checked={selectedSurface === surface}
                      onClick={() => handleSurfaceSelect(surface)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-all',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selectedSurface === surface
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40',
                        hasUnavailable && 'opacity-60'
                      )}
                    >
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      <span className="font-medium">{tTables(surface === 'top' ? 'surfaceTop' : 'surfaceBottom')}</span>
                      {hasUnavailable && (
                        <span className="text-[10px] text-muted-foreground">(parcialmente ocupada)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Time slots */}
          {(table.type !== 'removable_top' || selectedSurface) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {t('selectTime')}
              </Label>

              {availabilityLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{tCommon('loading')}</span>
                </div>
              ) : (
                <div
                  className="grid grid-cols-5 gap-1.5"
                  role="group"
                  aria-label="Horarios disponibles"
                >
                  {timeSlots.map((time) => {
                    const available = isSlotAvailable(time, selectedSurface ?? undefined)
                    const isStart = selectedStartTime === time
                    const isEnd = selectedEndTime === time
                    const isInRange =
                      selectedStartTime && selectedEndTime && time > selectedStartTime && time < selectedEndTime

                    return (
                      <button
                        key={time}
                        disabled={!available}
                        onClick={() => {
                          if (!selectedStartTime || (selectedStartTime && selectedEndTime)) {
                            setSelectedStartTime(time)
                            setSelectedEndTime(null)
                          } else if (time > selectedStartTime) {
                            setSelectedEndTime(time)
                          } else {
                            setSelectedStartTime(time)
                            setSelectedEndTime(null)
                          }
                        }}
                        className={cn(
                          'py-1 px-1.5 text-xs rounded transition-all font-medium',
                          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          available
                            ? cn(
                                'border hover:border-primary/60',
                                (isStart || isEnd) && 'bg-primary text-primary-foreground border-primary',
                                isInRange && 'bg-primary/20 border-primary/40',
                                !isStart && !isEnd && !isInRange && 'border-emerald/40 bg-emerald-dark/20 text-emerald-light'
                              )
                            : 'border border-crimson/40 bg-crimson-dark/30 text-destructive/70 cursor-not-allowed line-through'
                        )}
                        aria-label={`${time} — ${available ? 'disponible' : 'ocupado'}`}
                        aria-pressed={isStart || isEnd || !!isInRange}
                        aria-disabled={!available}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedStartTime && !selectedEndTime && (
                <p className="text-xs text-muted-foreground">
                  Inicio: {selectedStartTime} — Selecciona la hora de fin
                </p>
              )}
              {selectedStartTime && selectedEndTime && (
                <p className="text-xs text-primary font-medium">
                  {selectedStartTime} &rarr; {selectedEndTime}
                </p>
              )}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="rounded-md bg-emerald-dark/30 border border-emerald/40 px-3 py-2 text-sm text-emerald-light font-medium text-center">
              Reserva confirmada!
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t('cancel')}</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedStartTime ||
              !selectedEndTime ||
              (table.type === 'removable_top' && !selectedSurface) ||
              createReservation.isPending
            }
          >
            {createReservation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Reservando...</>
              : t('makeReservation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
