'use client'

import type { ClubEvent } from '@/lib/types'
import { formatClubEventDate } from '@/lib/club-events-format'

interface PastCardProps {
  event: ClubEvent
  locale: string
  onSelect: (event: ClubEvent) => void
}

export function PastCard({ event, locale, onSelect }: PastCardProps) {
  const title = locale === 'en' ? event.titleEn : event.titleEs
  const blurb = locale === 'en' ? event.blurbEn : event.blurbEs
  const dateLabel = formatClubEventDate(event, locale)

  return (
    <article className="mod-past-card">
      <button
        type="button"
        className="mod-past-btn"
        onClick={() => onSelect(event)}
        aria-label={title}
        draggable="false"
        onDragStart={(e) => e.preventDefault()}
      >
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt={title} loading="lazy" draggable="false" onDragStart={(e) => e.preventDefault()} />
        ) : (
          <span className="mod-past-img-placeholder" aria-hidden="true" />
        )}
        <span className="mod-past-overlay">
          <span className="mod-past-date">{dateLabel}</span>
          <span className="mod-past-h4">{title}</span>
          <span className="mod-past-p">{blurb}</span>
        </span>
      </button>
    </article>
  )
}
