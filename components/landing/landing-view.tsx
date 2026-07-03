import type { ClubEvent } from '@/lib/types'
import { LandingNav } from './landing-nav'
import { HeroSection } from './hero-section'
import { EventsSection } from './events-section'
import { GameLibrarySection } from './game-library-section'
import { AboutSection } from './about-section'
import { ClubValuesSection } from './club-values-section'
import { PartnersSection } from './partners-section'
import { MemberCtaSection } from './member-cta-section'
import { LandingFooterSection } from './landing-footer-section'

interface LandingViewProps {
  locale: string
  upcomingEvents: ClubEvent[]
  pastEvents: ClubEvent[]
}

export function LandingView({ locale, upcomingEvents, pastEvents }: LandingViewProps) {
  return (
    <div>
      <LandingNav locale={locale} />
      <HeroSection locale={locale} />
      <div id="events">
        <EventsSection events={upcomingEvents} locale={locale} variant="upcoming" />
      </div>
      <GameLibrarySection locale={locale} />
      <EventsSection events={pastEvents} locale={locale} variant="past" />
      <div id="about">
        <AboutSection />
      </div>
      <div id="culture">
        <ClubValuesSection />
      </div>
      <div id="partners">
        <PartnersSection locale={locale} />
      </div>
      <MemberCtaSection locale={locale} />
      <div id="contact">
        <LandingFooterSection locale={locale} />
      </div>
    </div>
  )
}
