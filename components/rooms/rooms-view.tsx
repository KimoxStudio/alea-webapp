'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { useRooms } from '@/lib/hooks/use-rooms'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RoomView } from './room-view'
import { Skeleton } from '@/components/ui/skeleton'

export function RoomsView() {
  const t = useTranslations('rooms')
  const { data: rooms, isLoading, error } = useRooms()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const today = new Date().toISOString().split('T')[0]
  const [currentDate] = useState(today)

  const activeTab = searchParams.get('sala') ?? (rooms?.[0]?.id ?? '')

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sala', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !rooms) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div role="alert" className="text-sm text-destructive bg-destructive/15 border border-destructive/30 rounded-lg p-4">
          Error al cargar las salas.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="font-cinzel text-2xl font-bold text-gradient-gold">{t('title')}</h1>
        </div>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Room tabs */}
      <Tabs
        value={activeTab || rooms[0]?.id}
        onValueChange={handleTabChange}
      >
        <TabsList
          className="flex-wrap h-auto gap-1 mb-6"
          aria-label="Salas de juego"
        >
          {rooms.map((room) => (
            <TabsTrigger
              key={room.id}
              value={room.id}
              className="min-w-[120px]"
            >
              {room.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {rooms.map((room) => (
          <TabsContent
            key={room.id}
            value={room.id}
            className="mt-0"
          >
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
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
