'use client'

import { useTranslations } from 'next-intl'
import type { ClubEvent } from '@/lib/types'
import { EventCard } from './event-card'
import { PastCard } from './past-card'
import { MarqueeRow } from './marquee-row'

interface EventsSectionProps {
  events: ClubEvent[]
  locale: string
  variant: 'upcoming' | 'past'
  onSelectEvent: (event: ClubEvent) => void
}

export function EventsSection({ events, locale, variant, onSelectEvent }: EventsSectionProps) {
  const t = useTranslations('home')

  const namespace = variant === 'upcoming' ? 'events' : 'past'
  const hasSubtitle = variant === 'past'
  const emptyMessage = variant === 'upcoming' ? t('events.empty') : t('past.empty')
  const prevLabel = locale === 'en' ? 'Previous event' : 'Evento anterior'
  const nextLabel = locale === 'en' ? 'Next event' : 'Siguiente evento'

  return (
    <section className={variant === 'upcoming' ? 'mod-events' : 'mod-past'} id={variant === 'upcoming' ? 'events' : undefined}>
      <div className="mod-section-head">
        <div>
          <span className="mod-kicker">{t(`${namespace}.kicker`)}</span>
          <h2 className="mod-h2">{t(`${namespace}.title`)}</h2>
          {hasSubtitle && <p className="mod-lead">{t('past.subtitle')}</p>}
        </div>
        {variant === 'upcoming' && (
          <a href={t('business.publicSite')} target="_blank" rel="noopener noreferrer" className="mod-arrow-link">
            {t('events.all')} →
          </a>
        )}
      </div>

      {events.length === 0 ? (
        <p style={{ opacity: 0.7, fontSize: 14 }}>{emptyMessage}</p>
      ) : (
        <MarqueeRow
          ariaLabel={t(`${namespace}.title`)}
          speedPxSec={variant === 'upcoming' ? 26 : 22}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
        >
          {events.map((event) =>
            variant === 'upcoming' ? (
              <EventCard key={event.id} event={event} locale={locale} onSelect={onSelectEvent} />
            ) : (
              <PastCard key={event.id} event={event} locale={locale} onSelect={onSelectEvent} />
            ),
          )}
        </MarqueeRow>
      )}
    </section>
  )
}
