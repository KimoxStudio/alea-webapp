'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MapPin } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useRooms } from '@/lib/hooks/use-rooms'
import { RoomView } from './room-view'

export function RoomsView() {
  const t = useTranslations('rooms')
  const { data: rooms, isLoading, error } = useRooms()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [currentDate] = useState(new Date().toISOString().split('T')[0])

  const activeTab = searchParams.get('sala') ?? (rooms?.[0]?.id ?? '')

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sala', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pb-20 pt-28">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[620px] rounded-3xl" />
        </div>
      </div>
    )
  }

  if (error || !rooms) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pb-20 pt-28">
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/15 p-4 text-sm text-destructive-foreground">
          Error al cargar las salas.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-20 pt-28">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-primary/80">{t('title')}</p>
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="font-cinzel text-4xl tracking-tight text-on-surface md:text-5xl">{t('title')}</h1>
          </div>
          <p className="text-on-surface-variant">{t('subtitle')}</p>
        </div>

        <Tabs value={activeTab || rooms[0]?.id} onValueChange={handleTabChange}>
          <TabsList className="h-auto flex-wrap gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-1.5" aria-label="Salas de juego">
            {rooms.map((room) => (
              <TabsTrigger key={room.id} value={room.id} className="min-w-[120px] rounded-xl px-6 py-2.5 text-sm">
                {room.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab || rooms[0]?.id} onValueChange={handleTabChange}>
        {rooms.map((room) => (
          <TabsContent key={room.id} value={room.id} className="mt-0">
            <div className="mb-4">
              <p className="text-sm text-on-surface-variant">
                {room.description && <span>{room.description} — </span>}
                <span>{room.tableCount} {t('tables')}</span>
              </p>
            </div>
            <RoomView roomId={room.id} currentDate={currentDate} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
