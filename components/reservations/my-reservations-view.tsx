'use client'

import { useEffect, useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import {
  CalendarDays,
  Clock3,
  Layers,
  Loader2,
  MapPin,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useMyReservations, useCreateReservation, useCancelReservation, useTableAvailability } from '@/lib/hooks/use-reservations'
import { useRooms, useRoomTables } from '@/lib/hooks/use-rooms'
import { cn, formatDate } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface MyReservationsViewProps {
  locale: string
}

const TIME_RANGES = [
  { start: '09:00', end: '12:00' },
  { start: '12:00', end: '15:00' },
  { start: '16:00', end: '19:00' },
  { start: '19:00', end: '22:00' },
]

export function MyReservationsView({ locale }: MyReservationsViewProps) {
  const isSpanish = locale === 'es'
  const { user } = useAuth()
  const { data: rooms = [] } = useRooms()
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const { data: tables = [] } = useRoomTables(selectedRoomId || null)
  const [selectedTableId, setSelectedTableId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedSurface, setSelectedSurface] = useState<'top' | 'bottom' | null>(null)
  const [cancelReservationId, setCancelReservationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedDateIso = selectedDate.toISOString().slice(0, 10)
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null
  const { data: availability } = useTableAvailability(selectedTableId || null, selectedDateIso)
  const { data: reservations = [], isLoading } = useMyReservations(user?.id ?? null)
  const createReservation = useCreateReservation()
  const cancelReservation = useCancelReservation()

  useEffect(() => {
    if (!rooms.length) return
    setSelectedRoomId((current) => current || rooms[0]!.id)
  }, [rooms])

  useEffect(() => {
    if (!tables.length) {
      setSelectedTableId('')
      return
    }
    setSelectedTableId((current) => tables.find((table) => table.id === current)?.id ?? tables[0]!.id)
  }, [tables])

  useEffect(() => {
    setSelectedRange(null)
    setSelectedSurface(null)
    setError(null)
  }, [selectedRoomId, selectedTableId, selectedDateIso])

  const activeReservations = reservations.filter((reservation) => reservation.status === 'active')
  const pastReservations = reservations.filter((reservation) => reservation.status !== 'active')

  const copy = isSpanish
    ? {
        title: 'Panel de reservas',
        subtitle: 'Gestiona espacios, horarios y superficies dentro de la asociacion.',
        newReservation: 'Nueva reserva',
        myReservations: 'Mis reservas',
        room: 'Sala',
        table: 'Mesa',
        layerConfig: 'Configuracion de superficie',
        topCover: 'Top Cover',
        bottomSurface: 'Bottom Surface',
        available: 'Disponible',
        occupied: 'Ocupada',
        confirmReservation: 'Confirmar reserva',
        upcoming: 'Proxima sesion',
        completed: 'Completada',
        noReservations: 'Aun no tienes reservas en tu historial.',
        confirmCancel: 'Estas seguro de que deseas cancelar esta reserva?',
        slotError: 'Ese tramo ya no esta disponible.',
        surfaceError: 'Selecciona una superficie.',
        loadingReservations: 'Cargando reservas...',
      }
    : {
        title: 'Reservations Panel',
        subtitle: 'Manage spaces, slots, and layered tables across the association.',
        newReservation: 'New reservation',
        myReservations: 'My reservations',
        room: 'Room',
        table: 'Table',
        layerConfig: 'Layer configuration',
        topCover: 'Top Cover',
        bottomSurface: 'Bottom Surface',
        available: 'Available',
        occupied: 'Occupied',
        confirmReservation: 'Confirm reservation',
        upcoming: 'Upcoming session',
        completed: 'Completed',
        noReservations: 'You do not have reservations in your history yet.',
        confirmCancel: 'Are you sure you want to cancel this reservation?',
        slotError: 'That time slot is no longer available.',
        surfaceError: 'Select a surface.',
        loadingReservations: 'Loading reservations...',
      }

  const slotAvailability = useMemo(() => {
    const slots = selectedTable?.type === 'removable_top'
      ? (selectedSurface === 'top' ? availability?.top : selectedSurface === 'bottom' ? availability?.bottom : undefined)
      : availability?.slots

    return TIME_RANGES.map((range) => ({
      ...range,
      available: slots?.find((slot) => slot.startTime === range.start)?.available ?? true,
    }))
  }, [availability, selectedSurface, selectedTable?.type])

  async function handleCreateReservation() {
    if (!selectedTable || !selectedRange) return
    if (selectedTable.type === 'removable_top' && !selectedSurface) {
      setError(copy.surfaceError)
      return
    }

    setError(null)
    try {
      await createReservation.mutateAsync({
        tableId: selectedTable.id,
        date: selectedDateIso,
        startTime: selectedRange.start,
        endTime: selectedRange.end,
        surface: selectedTable.type === 'removable_top' ? selectedSurface ?? undefined : undefined,
      })
      setSelectedRange(null)
    } catch {
      setError(copy.slotError)
    }
  }

  return (
    <div className="relative overflow-hidden px-6 pb-20 pt-32 md:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,183,123,0.14),transparent_34%)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10">
          <h1 className="font-cinzel text-5xl italic tracking-tight text-foreground">{copy.title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-on-surface-variant">{copy.subtitle}</p>
        </div>

        <div className="grid grid-cols-12 items-start gap-6">
          <section className="col-span-12 space-y-6 lg:col-span-8">
            <div className="rounded-2xl border-l-2 border-primary bg-surface-container-low p-8">
              <h2 className="font-cinzel text-2xl italic text-primary">{copy.newReservation}</h2>

              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{copy.room}</label>
                    <select
                      value={selectedRoomId}
                      onChange={(event) => setSelectedRoomId(event.target.value)}
                      className="flex h-12 w-full rounded-md border border-outline-variant/20 bg-background-secondary px-3 text-sm text-foreground"
                    >
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{copy.table}</label>
                    <select
                      value={selectedTableId}
                      onChange={(event) => setSelectedTableId(event.target.value)}
                      className="flex h-12 w-full rounded-md border border-outline-variant/20 bg-background-secondary px-3 text-sm text-foreground"
                    >
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>{table.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTable?.type === 'removable_top' && (
                    <div className="rounded-xl border border-primary/20 bg-surface-container p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-primary/80">{copy.layerConfig}</p>
                          <p className="mt-1 text-sm text-on-surface-variant">
                            {isSpanish ? 'Selecciona la superficie que deseas reservar.' : 'Choose the surface you want to reserve.'}
                          </p>
                        </div>
                        <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                      </div>

                      <div className="space-y-3">
                        {([
                          ['top', copy.topCover],
                          ['bottom', copy.bottomSurface],
                        ] as const).map(([surface, label]) => {
                          const available = surface === 'top'
                            ? availability?.top?.some((slot) => slot.available) ?? true
                            : availability?.bottom?.some((slot) => slot.available) ?? true
                          const selected = selectedSurface === surface

                          return (
                            <button
                              key={surface}
                              type="button"
                              onClick={() => setSelectedSurface(surface)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
                                selected ? 'border-primary bg-primary/10' : 'border-outline-variant/20 bg-background-secondary/70'
                              )}
                            >
                              <span className="text-sm text-foreground">{label}</span>
                              <span className={cn(
                                'rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em]',
                                available ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive-foreground'
                              )}>
                                {available ? copy.available : copy.occupied}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl bg-surface-container-lowest p-4">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                      classNames={{
                        month: 'space-y-4',
                        caption_label: 'font-cinzel text-lg text-foreground',
                        nav_button: 'h-8 w-8 rounded-full border border-outline-variant/20 text-foreground',
                        weekdays: 'grid grid-cols-7 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground',
                        weekday: 'py-2',
                        week: 'grid grid-cols-7 gap-1',
                        day: 'h-10 w-full rounded-md text-sm text-foreground transition-colors hover:bg-primary/10',
                        selected: 'bg-primary text-on-primary hover:bg-primary',
                        today: 'border border-primary/40',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                    {slotAvailability.map((slot) => {
                      const selected = selectedRange?.start === slot.start
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedRange(slot)}
                          className={cn(
                            'rounded-xl border px-3 py-4 text-left transition-colors',
                            !slot.available
                              ? 'cursor-not-allowed border-outline-variant/15 bg-surface-container-lowest text-outline opacity-40'
                              : selected
                                ? 'border-primary bg-primary text-on-primary'
                                : 'border-outline-variant/15 bg-surface-container-low hover:border-primary/30'
                          )}
                        >
                          <p className="text-xs uppercase tracking-[0.18em]">{slot.start} - {slot.end}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2 md:col-span-2">
                  <Button
                    className="px-10 py-3 font-bold uppercase tracking-[0.22em]"
                    disabled={!selectedRange || createReservation.isPending}
                    onClick={handleCreateReservation}
                  >
                    {createReservation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />...</> : copy.confirmReservation}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                  {error}
                </div>
              )}
            </div>
          </section>

          <aside className="col-span-12 space-y-6 lg:col-span-4">
            <section className="rounded-2xl bg-surface-container-high p-8">
              <h2 className="font-cinzel text-2xl italic text-secondary">{copy.myReservations}</h2>

              {isLoading ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-on-surface-variant">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{copy.loadingReservations}</span>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {activeReservations.map((reservation) => (
                    <article key={reservation.id} className="relative overflow-hidden rounded-xl bg-surface-container-low p-4">
                      <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] text-primary/75">{copy.upcoming}</p>
                          <h3 className="mt-2 font-cinzel text-lg text-foreground">{reservation.tableId}</h3>
                        </div>
                        <button type="button" onClick={() => setCancelReservationId(reservation.id)} className="text-muted-foreground transition-colors hover:text-destructive">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-on-surface-variant">
                        <p className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{reservation.tableId}</p>
                        <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatDate(reservation.date, isSpanish ? 'es-ES' : 'en-US')}</p>
                        <p className="flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden="true" />{reservation.startTime} - {reservation.endTime}</p>
                        {reservation.surface && (
                          <p className="flex items-center gap-2"><Layers className="h-4 w-4" aria-hidden="true" />{reservation.surface === 'top' ? copy.topCover : copy.bottomSurface}</p>
                        )}
                      </div>
                    </article>
                  ))}

                  {pastReservations.map((reservation) => (
                    <article key={reservation.id} className="rounded-xl bg-surface-container-lowest p-4 opacity-70">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{copy.completed}</p>
                      <h3 className="mt-2 font-cinzel text-lg text-stone-400">{reservation.tableId}</h3>
                    </article>
                  ))}

                  {reservations.length === 0 && (
                    <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
                      {copy.noReservations}
                    </div>
                  )}

                  <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(255,183,123,0.16),transparent_38%)]" />
                    <div className="relative flex items-center gap-3 text-primary">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                      <span className="text-[11px] uppercase tracking-[0.22em]">Ambient archive</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      <AlertDialog open={!!cancelReservationId} onOpenChange={(nextOpen) => !nextOpen && setCancelReservationId(null)}>
        <AlertDialogContent className="border-outline-variant/10 bg-surface-container-low text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cinzel text-2xl italic">
              {isSpanish ? 'Cancelar reserva' : 'Cancel reservation'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant">
              {copy.confirmCancel}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isSpanish ? 'Volver' : 'Back'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                if (cancelReservationId) {
                  void cancelReservation.mutateAsync(cancelReservationId).finally(() => setCancelReservationId(null))
                }
              }}
            >
              {cancelReservation.isPending ? (isSpanish ? 'Cancelando...' : 'Cancelling...') : (isSpanish ? 'Confirmar' : 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
