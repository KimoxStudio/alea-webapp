'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Table2 } from 'lucide-react'
import type { GameTable } from '@/lib/types'
import { useRoomTables } from '@/lib/hooks/use-rooms'
import { useRoomAvailability } from '@/lib/hooks/use-reservations'
import { TableCard } from './table-card'
import { ReservationDialog } from './reservation-dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface RoomViewProps {
  roomId: string
  currentDate: string
}

function TableAvailabilityWrapper({
  table,
  currentDate,
  availability,
  onReserve,
}: {
  table: GameTable
  currentDate: string
  availability?: import('@/lib/types').TableAvailability
  onReserve: (table: GameTable) => void
}) {
  return (
    <TableCard
      table={table}
      availability={availability}
      onReserve={onReserve}
      currentDate={currentDate}
    />
  )
}

export function RoomView({ roomId, currentDate }: RoomViewProps) {
  const t = useTranslations('rooms')
  const { data: tables, isLoading, error } = useRoomTables(roomId)
  const { data: availabilityByTable, isLoading: availabilityLoading } = useRoomAvailability(roomId, currentDate)
  const [selectedTable, setSelectedTable] = useState<GameTable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleReserve(table: GameTable) {
    setSelectedTable(table)
    setDialogOpen(true)
  }

  if (isLoading || availabilityLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" aria-busy="true" aria-label="Cargando mesas...">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
        <span className="sr-only">{t('title')} cargando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="text-sm text-destructive bg-destructive/15 border border-destructive/30 rounded-lg p-4">
        Error al cargar las mesas. Intentalo de nuevo.
      </div>
    )
  }

  if (!tables || tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Table2 className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
        <p className="text-muted-foreground">{t('noTables')}</p>
      </div>
    )
  }

  return (
    <>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        role="list"
        aria-label="Mesas de la sala"
      >
        {tables.map((table) => (
          <div key={table.id} role="listitem">
            <TableAvailabilityWrapper
              table={table}
              currentDate={currentDate}
              availability={availabilityByTable?.[table.id]}
              onReserve={handleReserve}
            />
          </div>
        ))}
      </div>

      <ReservationDialog
        table={selectedTable}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setSelectedTable(null)
        }}
      />
    </>
  )
}
