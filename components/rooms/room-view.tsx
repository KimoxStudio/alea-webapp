'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Layers, Table2, Users } from 'lucide-react'
import type { GameTable, TableAvailability } from '@/lib/types'
import { useRoomTables } from '@/lib/hooks/use-rooms'
import { useRoomAvailability } from '@/lib/hooks/use-reservations'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReservationDialog } from './reservation-dialog'
import { TableCard } from './table-card'

interface RoomViewProps {
  roomId: string
  currentDate: string
}

export function RoomView({ roomId, currentDate }: RoomViewProps) {
  const t = useTranslations('rooms')
  const { data: tables, isLoading, error } = useRoomTables(roomId)
  const { data: availabilityByTable, isLoading: availabilityLoading } = useRoomAvailability(roomId, currentDate)
  const [selectedTable, setSelectedTable] = useState<GameTable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!tables?.length) return
    if (selectedTable && tables.some((table) => table.id === selectedTable.id)) return
    setSelectedTable(tables[0])
  }, [tables, selectedTable])

  function handleSelectTable(table: GameTable) {
    setSelectedTable(table)
  }

  if (isLoading || availabilityLoading) {
    return (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12" aria-busy="true" aria-label="Cargando mesas...">
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-[620px] rounded-3xl" />
        </div>
        <Skeleton className="h-[420px] rounded-3xl lg:col-span-4" />
        <span className="sr-only">{t('title')} cargando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/15 p-4 text-sm text-destructive-foreground">
        Error al cargar las mesas. Intentalo de nuevo.
      </div>
    )
  }

  if (!tables || tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Table2 className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground">{t('noTables')}</p>
      </div>
    )
  }

  const selectedAvailability = selectedTable ? availabilityByTable?.[selectedTable.id] : undefined

  return (
    <>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="rounded-3xl bg-surface-container-low/60 p-6 backdrop-blur-sm md:p-10">
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-primary">
                <span className="h-2 w-2 rounded-full border border-primary" />
                {t('available')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-container/20 px-3 py-2 text-primary/80">
                <span className="h-2 w-2 rounded-full bg-primary-container/70" />
                {t('partial')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-high px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-outline-variant/50" />
                {t('reserved')}
              </span>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-6 justify-items-center md:grid-cols-3 md:gap-12" role="list" aria-label="Mesas de la sala">
              {tables.map((table) => (
                <div key={table.id} role="listitem" className="w-full max-w-[220px]">
                  <TableCard
                    table={table}
                    availability={availabilityByTable?.[table.id]}
                    onReserve={handleSelectTable}
                    currentDate={currentDate}
                    selected={selectedTable?.id === table.id}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="rounded-3xl border border-primary/10 bg-surface-container-high/90 backdrop-blur-md lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
          {selectedTable ? (
            <>
              <div className="relative overflow-hidden rounded-t-3xl border-b border-outline-variant/10 bg-[radial-gradient(circle_at_top_right,rgba(255,183,123,0.2),transparent_45%),linear-gradient(180deg,rgba(28,27,27,1),rgba(42,42,42,1))] px-6 py-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-primary">Selected</span>
                <h2 className="mt-3 font-cinzel text-3xl text-foreground">{selectedTable.name}</h2>
                <p className="mt-2 text-sm capitalize text-on-surface-variant">{selectedTable.type.replace(/_/g, ' ')}</p>
              </div>

              <div className="space-y-6 p-6">
                {selectedTable.type === 'removable_top' && (
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container p-1">
                    <div className="rounded-xl bg-primary px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-on-primary">
                      Top Cover
                    </div>
                    <div className="rounded-xl px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
                      Bottom Surface
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-surface-container px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Type</p>
                    <p className="mt-2 font-cinzel text-lg text-foreground capitalize">{selectedTable.type.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="rounded-2xl bg-surface-container px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Capacity</p>
                    <p className="mt-2 flex items-center gap-2 font-cinzel text-lg text-foreground">
                      <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                      {selectedTable.type === 'small' ? '2-4' : selectedTable.type === 'large' ? '4-8' : '4-6'}
                    </p>
                  </div>
                </div>

                {selectedTable.type === 'removable_top' && (
                  <div className="rounded-2xl bg-surface-container px-4 py-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      <span className="text-[11px] uppercase tracking-[0.2em]">Dual surface</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                      Reserve the lid or the inner play surface independently according to current availability.
                    </p>
                  </div>
                )}

                {selectedAvailability && selectedTable.type === 'removable_top' && (
                  <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-container-lowest/70 p-4">
                    <StatusMetric label="Top" available={selectedAvailability.top?.some((slot) => slot.available) ?? false} />
                    <StatusMetric label="Bottom" available={selectedAvailability.bottom?.some((slot) => slot.available) ?? false} />
                  </div>
                )}

                <Button className="h-12 w-full font-bold uppercase tracking-[0.24em]" onClick={() => setDialogOpen(true)}>
                  {t('reserveTable')}
                </Button>
              </div>
            </>
          ) : (
            <div className="p-6 text-sm text-on-surface-variant">Select a table to inspect its detail panel.</div>
          )}
        </aside>
      </div>

      <ReservationDialog
        table={selectedTable}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
        }}
      />
    </>
  )
}

function StatusMetric({ label, available }: { label: string; available: boolean }) {
  return (
    <div className="rounded-xl bg-surface-container px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={available ? 'mt-2 text-sm font-semibold text-primary' : 'mt-2 text-sm font-semibold text-stone-400'}>
        {available ? 'Available' : 'Occupied'}
      </p>
    </div>
  )
}
