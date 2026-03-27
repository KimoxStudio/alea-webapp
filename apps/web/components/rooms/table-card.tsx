'use client'

import { useTranslations } from 'next-intl'
import { Shield, Square, Layers, QrCode } from 'lucide-react'
import type { GameTable, TableAvailability } from '@alea/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface TableCardProps {
  table: GameTable
  availability?: TableAvailability
  onReserve: (table: GameTable) => void
  currentDate: string
}

const TABLE_TYPE_ICONS = {
  small: Square,
  large: Shield,
  removable_top: Layers,
}

function getTableStatus(table: GameTable, availability?: TableAvailability) {
  if (!availability) return 'unknown'

  if (table.type === 'removable_top' && availability.top && availability.bottom) {
    const topFull = availability.top.every(s => !s.available)
    const bottomFull = availability.bottom.every(s => !s.available)
    if (topFull && bottomFull) return 'reserved'
    if (topFull || bottomFull) return 'partial'
    return 'available'
  }

  const hasAnyReservation = availability.slots.some(s => !s.available)
  const allReserved = availability.slots.every(s => !s.available)
  if (allReserved) return 'reserved'
  if (hasAnyReservation) return 'partial'
  return 'available'
}

export function TableCard({ table, availability, onReserve, currentDate: _currentDate }: TableCardProps) {
  const t = useTranslations('tables')
  const tRooms = useTranslations('rooms')
  const Icon = TABLE_TYPE_ICONS[table.type]
  const status = getTableStatus(table, availability)

  const statusConfig = {
    available: { label: tRooms('available'), badgeVariant: 'available' as const, cardClass: 'table-available cursor-pointer' },
    partial: { label: tRooms('partial'), badgeVariant: 'partial' as const, cardClass: 'table-partial cursor-pointer' },
    reserved: { label: tRooms('reserved'), badgeVariant: 'reserved' as const, cardClass: 'table-reserved cursor-not-allowed opacity-75' },
    unknown: { label: '...', badgeVariant: 'outline' as const, cardClass: 'cursor-pointer' },
  }

  const config = statusConfig[status]

  return (
    <button
      onClick={() => status !== 'reserved' && onReserve(table)}
      disabled={status === 'reserved'}
      className={cn(
        'group relative flex flex-col items-center justify-between p-4 rounded-lg border transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'min-h-[120px] w-full text-left',
        config.cardClass
      )}
      aria-label={`${table.name} — ${t(table.type)} — ${config.label}`}
      aria-disabled={status === 'reserved'}
    >
      {/* Table type icon */}
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              'h-5 w-5',
              status === 'available' && 'text-emerald-light',
              status === 'partial' && 'text-gold-400',
              status === 'reserved' && 'text-crimson-light',
              status === 'unknown' && 'text-muted-foreground'
            )}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold font-cinzel">{table.name}</span>
        </div>
        <Badge variant={config.badgeVariant} className="text-[10px] px-1.5 py-0.5">
          {config.label}
        </Badge>
      </div>

      {/* Table type label */}
      <div className="w-full">
        <p className="text-xs text-muted-foreground">{t(table.type)}</p>

        {/* Removable top special indicator */}
        {table.type === 'removable_top' && availability?.top && availability?.bottom && (
          <div className="flex gap-1 mt-1.5" role="group" aria-label="Estado de superficies">
            <span
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded border',
                availability.top.some(s => !s.available)
                  ? 'border-crimson/40 bg-crimson-dark/20 text-crimson-light'
                  : 'border-emerald/40 bg-emerald-dark/20 text-emerald-light'
              )}
              aria-label={`Superior: ${availability.top.some(s => !s.available) ? 'ocupada' : 'libre'}`}
            >
              ↑ SUP
            </span>
            <span
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded border',
                availability.bottom.some(s => !s.available)
                  ? 'border-crimson/40 bg-crimson-dark/20 text-crimson-light'
                  : 'border-emerald/40 bg-emerald-dark/20 text-emerald-light'
              )}
              aria-label={`Inferior: ${availability.bottom.some(s => !s.available) ? 'ocupada' : 'libre'}`}
            >
              ↓ INF
            </span>
          </div>
        )}
      </div>

      {/* QR indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <QrCode className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      </div>
    </button>
  )
}
