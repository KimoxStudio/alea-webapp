'use client'

import { useTranslations } from 'next-intl'
import { Layers, QrCode, Shield, Square } from 'lucide-react'
import type { GameTable, TableAvailability } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TableCardProps {
  table: GameTable
  availability?: TableAvailability
  onReserve: (table: GameTable) => void
  currentDate: string
  selected?: boolean
}

const TABLE_TYPE_ICONS = {
  small: Square,
  large: Shield,
  removable_top: Layers,
}

function getTableStatus(table: GameTable, availability?: TableAvailability) {
  if (!availability) return 'unknown'

  if (table.type === 'removable_top' && availability.top && availability.bottom) {
    const topFull = availability.top.every((slot) => !slot.available)
    const bottomFull = availability.bottom.every((slot) => !slot.available)
    if (topFull && bottomFull) return 'reserved'
    if (topFull || bottomFull) return 'partial'
    return 'available'
  }

  const hasAnyReservation = availability.slots.some((slot) => !slot.available)
  const allReserved = availability.slots.every((slot) => !slot.available)
  if (allReserved) return 'reserved'
  if (hasAnyReservation) return 'partial'
  return 'available'
}

export function TableCard({ table, availability, onReserve, currentDate: _currentDate, selected = false }: TableCardProps) {
  const t = useTranslations('tables')
  const tRooms = useTranslations('rooms')
  const Icon = TABLE_TYPE_ICONS[table.type]
  const status = getTableStatus(table, availability)

  const statusConfig = {
    available: { label: tRooms('available'), badgeVariant: 'available' as const, accentClass: 'border-primary text-primary bg-background/50' },
    partial: { label: tRooms('partial'), badgeVariant: 'partial' as const, accentClass: 'bg-primary-container/60 text-primary border-primary/40' },
    reserved: { label: tRooms('reserved'), badgeVariant: 'reserved' as const, accentClass: 'border-outline-variant/30 bg-surface-container-highest/40 text-stone-500 opacity-75' },
    unknown: { label: '...', badgeVariant: 'outline' as const, accentClass: 'border-outline-variant/30 text-muted-foreground' },
  }

  const config = statusConfig[status]
  const topSlots = table.type === 'removable_top' ? availability?.top ?? [] : []
  const bottomSlots = table.type === 'removable_top' ? availability?.bottom ?? [] : []
  const hasDualSurface = topSlots.length > 0 && bottomSlots.length > 0
  const topAvailable = hasDualSurface ? topSlots.every((slot) => slot.available) : false
  const bottomAvailable = hasDualSurface ? bottomSlots.every((slot) => slot.available) : false

  return (
    <button
      onClick={() => status !== 'reserved' && onReserve(table)}
      disabled={status === 'reserved'}
      className={cn(
        'group relative flex min-h-[168px] w-full flex-col items-center justify-between rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 p-5 text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected && 'border-primary/40 bg-surface-container-high/80 shadow-[0_0_30px_rgba(255,183,123,0.12)]',
        status === 'reserved' && 'cursor-not-allowed',
        status !== 'reserved' && 'hover:-translate-y-1 hover:border-primary/30'
      )}
      aria-label={`${table.name} — ${t(table.type)} — ${config.label}`}
      aria-disabled={status === 'reserved'}
    >
      <div className="mb-4 flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-cinzel text-sm font-semibold">{table.name}</span>
        </div>
        <Badge variant={config.badgeVariant} className="px-1.5 py-0.5 text-[10px]">
          {config.label}
        </Badge>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div
          className={cn(
            'relative flex items-center justify-center border-2 transition-colors',
            table.type === 'small' && 'h-24 w-24 rounded-full',
            table.type === 'large' && 'h-24 w-36 rounded-xl',
            table.type === 'removable_top' && 'h-28 w-28 rounded-2xl ring-2 ring-primary/20',
            config.accentClass
          )}
        >
          {table.type === 'removable_top' && (
            <div className="absolute inset-2 rounded-xl border border-dashed border-primary/25" aria-hidden="true" />
          )}
          <span className="px-2 text-center font-cinzel text-sm" aria-hidden="true">
            {table.type === 'small' ? '2-4' : table.type === 'large' ? '6-8' : '4-6'}
          </span>
        </div>
      </div>

      <div className="mt-4 w-full">
        <p className="text-xs text-muted-foreground">{t(table.type)}</p>
        {hasDualSurface && (
          <div className="mt-2 flex gap-2" role="group" aria-label="Estado de superficies">
            <span className={cn('rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em]', topAvailable ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/30 bg-surface-container text-stone-400')}>
              Top
            </span>
            <span className={cn('rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em]', bottomAvailable ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/30 bg-surface-container text-stone-400')}>
              Bottom
            </span>
          </div>
        )}
      </div>

      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <QrCode className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      </div>
    </button>
  )
}
