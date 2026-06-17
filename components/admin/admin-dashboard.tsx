'use client'

import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, CalendarDays, DoorOpen, CalendarRange, Package } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UsersSection } from './users-section'
import { ReservationsSection } from './reservations-section'
import { RoomsSection } from './rooms-section'
import { EventsSection } from './events-section'
import { EquipmentSection } from './equipment-section'

export function AdminDashboard() {
  const t = useTranslations('admin')

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8 relative">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-16 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20">
            <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-cinzel text-2xl font-bold text-gradient-gold leading-tight">
              {t('dashboard')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-inter">
              {t('dashboardSubtitle')}
            </p>
          </div>
        </div>
        <div className="mt-4 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" aria-hidden="true" />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6 h-auto w-full flex-wrap justify-center gap-1 border border-border bg-background-secondary/80 p-1">
          <TabsTrigger value="users" className="gap-2 data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:glow-gold">
            <Users className="h-4 w-4" aria-hidden="true" />
            {t('users')}
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2 data-[state=active]:border data-[state=active]:border-primary/30">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {t('reservations')}
          </TabsTrigger>
          <TabsTrigger value="rooms" className="gap-2 data-[state=active]:border data-[state=active]:border-primary/30">
            <DoorOpen className="h-4 w-4" aria-hidden="true" />
            {t('rooms')}
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2 data-[state=active]:border data-[state=active]:border-primary/30">
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            {t('events.title')}
          </TabsTrigger>
          <TabsTrigger value="equipment" className="gap-2 data-[state=active]:border data-[state=active]:border-primary/30">
            <Package className="h-4 w-4" aria-hidden="true" />
            {t('equipment.title')}
          </TabsTrigger>
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

        <TabsContent value="events">
          <EventsSection />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
