'use client'

import { useState, type ReactNode } from 'react'
import type { ClubEvent } from '@/lib/types'
import { LandingNav } from './landing-nav'
import { HeroSection } from './hero-section'
import { Ticker } from './ticker'
import { EventsSection } from './events-section'
import { EventDetailsDialog } from './event-details-dialog'
import { CustomCursor } from './custom-cursor'
import { HexGridBackground } from './hex-grid-background'

interface LandingClientProps {
  locale: string
  upcomingEvents: ClubEvent[]
  pastEvents: ClubEvent[]
  gameLibrarySlot: ReactNode
  aboutSlot: ReactNode
  cultureSlot: ReactNode
  partnersSlot: ReactNode
  ctaSlot: ReactNode
  footerSlot: ReactNode
}

/**
 * Client boundary for the landing page: owns the event-details modal state
 * shared between the hero D20 roller and the events/past-events carousels,
 * and renders the custom cursor. Server-rendered sections that don't need
 * this shared state are passed in as slots so they stay server components.
 */
export function LandingClient({
  locale,
  upcomingEvents,
  pastEvents,
  gameLibrarySlot,
  aboutSlot,
  cultureSlot,
  partnersSlot,
  ctaSlot,
  footerSlot,
}: LandingClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null)
  const selectedVariant = selectedEvent && upcomingEvents.some((e) => e.id === selectedEvent.id) ? 'upcoming' : 'past'

  return (
    <div className="modern-root">
      <HexGridBackground />
      <CustomCursor />
      <LandingNav locale={locale} />
      <HeroSection locale={locale} upcomingEvents={upcomingEvents} onPickEvent={setSelectedEvent} />
      <Ticker locale={locale} />
      <EventsSection events={upcomingEvents} locale={locale} variant="upcoming" onSelectEvent={setSelectedEvent} />
      {gameLibrarySlot}
      <EventsSection events={pastEvents} locale={locale} variant="past" onSelectEvent={setSelectedEvent} />
      {aboutSlot}
      {cultureSlot}
      {partnersSlot}
      {ctaSlot}
      {footerSlot}

      <EventDetailsDialog
        event={selectedEvent}
        locale={locale}
        variant={selectedVariant}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
      />
    </div>
  )
}
