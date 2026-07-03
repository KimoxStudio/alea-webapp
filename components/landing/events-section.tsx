'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ClubEvent } from '@/lib/types'
import { EventCard } from './event-card'
import { EventDetailsDialog } from './event-details-dialog'

interface EventsSectionProps {
  events: ClubEvent[]
  locale: string
  variant: 'upcoming' | 'past'
}

export function EventsSection({ events, locale, variant }: EventsSectionProps) {
  const t = useTranslations('home')
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null)

  const namespace = variant === 'upcoming' ? 'events' : 'past'
  const hasSubtitle = variant === 'past'
  const emptyMessage = variant === 'upcoming' ? t('events.empty') : t('past.empty')

  return (
    <section
      className={variant === 'past' ? 'border-t border-border bg-background-secondary' : undefined}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {t(`${namespace}.kicker`)}
          </p>
          <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t(`${namespace}.title`)}
          </h2>
          {hasSubtitle && (
            <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
              {t('past.subtitle')}
            </p>
          )}
        </header>

        {events.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                locale={locale}
                variant={variant}
                onSelect={setSelectedEvent}
              />
            ))}
          </div>
        )}

        {variant === 'upcoming' && (
          <div className="mt-10 text-center">
            <a
              href={t('business.publicSite')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('events.all')}
            </a>
          </div>
        )}
      </div>

      <EventDetailsDialog
        event={selectedEvent}
        locale={locale}
        variant={variant}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
      />
    </section>
  )
}
