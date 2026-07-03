'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Dices } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ClubEvent } from '@/lib/types'
import { formatClubEventDate } from '@/lib/club-events-format'

interface EventCardProps {
  event: ClubEvent
  locale: string
  variant: 'upcoming' | 'past'
  onSelect: (event: ClubEvent) => void
}

export function EventCard({ event, locale, variant, onSelect }: EventCardProps) {
  const t = useTranslations('home')
  const title = locale === 'en' ? event.titleEn : event.titleEs
  const blurb = locale === 'en' ? event.blurbEn : event.blurbEs
  const dateLabel = formatClubEventDate(event, locale)
  const viewDetailsLabel = variant === 'upcoming' ? t('events.viewDetails') : t('past.viewDetails')

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative flex h-40 w-full items-center justify-center bg-background-secondary">
        {event.imageUrl ? (
          <Image src={event.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        ) : (
          <Dices className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        )}
      </div>
      <CardHeader className="flex-1">
        <Badge variant={event.status === 'upcoming' ? 'available' : 'secondary'} className="mb-2 w-fit">
          {event.status === 'upcoming' ? t('eventStatus.upcoming') : t('eventStatus.past')}
        </Badge>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-xs font-medium text-muted-foreground">{dateLabel}</p>
        <CardDescription>{blurb}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={() => onSelect(event)}>
          {viewDetailsLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
