'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClubEventsSection } from './club-events-section'
import { EventsSection } from './events-section'

/**
 * OIR-206: thin wrapper for the single top-level "Eventos" tab. The board
 * sees one "Events" tab with two inner sub-tabs — "Club (landing)" (public
 * marketing events, default) and "Internos (salas)" (legacy room-booking
 * events) — instead of two separate top-level tabs. Both section components
 * are reused as-is; no logic changes here.
 */
export function EventsTab() {
  const t = useTranslations('admin')

  return (
    <Tabs defaultValue="club">
      <TabsList className="mb-4">
        <TabsTrigger value="club">{t('eventsTab.clubSubTab')}</TabsTrigger>
        <TabsTrigger value="internal">{t('eventsTab.internalSubTab')}</TabsTrigger>
      </TabsList>
      <TabsContent value="club">
        <ClubEventsSection />
      </TabsContent>
      <TabsContent value="internal">
        <EventsSection />
      </TabsContent>
    </Tabs>
  )
}
