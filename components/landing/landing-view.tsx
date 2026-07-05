import type { ClubEvent, LibraryGame, Partner } from '@/lib/types'
import './landing.css'
import { LandingClient } from './landing-client'
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
  partners: Partner[]
  games: LibraryGame[]
}

export function LandingView({ locale, upcomingEvents, pastEvents, partners, games }: LandingViewProps) {
  return (
    <LandingClient
      locale={locale}
      upcomingEvents={upcomingEvents}
      pastEvents={pastEvents}
      gameLibrarySlot={<GameLibrarySection locale={locale} games={games} />}
      aboutSlot={<AboutSection />}
      cultureSlot={<ClubValuesSection />}
      partnersSlot={<PartnersSection locale={locale} partners={partners} />}
      ctaSlot={<MemberCtaSection locale={locale} />}
      footerSlot={<LandingFooterSection locale={locale} />}
    />
  )
}
