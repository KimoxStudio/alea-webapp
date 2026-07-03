import type { ClubEvent } from '@/lib/types'
import { HeroSection } from './hero-section'
import { EventsSection } from './events-section'
import { GameLibrarySection } from './game-library-section'
import { ClubValuesSection } from './club-values-section'
import { PartnersSection } from './partners-section'
import { MemberCtaSection } from './member-cta-section'

interface LandingViewProps {
  locale: string
  upcomingEvents: ClubEvent[]
  pastEvents: ClubEvent[]
}

export function LandingView({ locale, upcomingEvents, pastEvents }: LandingViewProps) {
  return (
    <div>
      <HeroSection locale={locale} />
      <EventsSection events={upcomingEvents} locale={locale} variant="upcoming" />
      <GameLibrarySection />
      <EventsSection events={pastEvents} locale={locale} variant="past" />
      <ClubValuesSection />
      <PartnersSection />
      <MemberCtaSection locale={locale} />
    </div>
  )
}
