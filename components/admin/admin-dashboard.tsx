'use client'

import { useTranslations } from 'next-intl'
import { LayoutDashboard } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UsersSection } from './users-section'
import { ReservationsSection } from './reservations-section'
import { RoomsSection } from './rooms-section'

export function AdminDashboard() {
  const t = useTranslations('admin')

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <LayoutDashboard className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="font-cinzel text-2xl font-bold text-gradient-gold">{t('dashboard')}</h1>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">{t('users')}</TabsTrigger>
          <TabsTrigger value="reservations">{t('reservations')}</TabsTrigger>
          <TabsTrigger value="rooms">{t('rooms')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersSection />
        </TabsContent>

        <TabsContent value="reservations">
          <ReservationsSection />
        </TabsContent>

        <TabsContent value="rooms">
          <RoomsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
