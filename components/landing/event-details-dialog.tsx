'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ClubEvent } from '@/lib/types'
import { formatClubEventDate } from '@/lib/club-events-format'

interface EventDetailsDialogProps {
  event: ClubEvent | null
  locale: string
  onOpenChange: (open: boolean) => void
}

export function EventDetailsDialog({ event, locale, onOpenChange }: EventDetailsDialogProps) {
  const t = useTranslations('home')

  if (!event) return null

  const title = locale === 'en' ? event.titleEn : event.titleEs
  const description = (locale === 'en' ? event.descriptionEn : event.descriptionEs) ??
    (locale === 'en' ? event.blurbEn : event.blurbEs)
  const dateLabel = formatClubEventDate(event, locale)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <Badge variant={event.status === 'upcoming' ? 'available' : 'secondary'} className="mb-2 w-fit">
            {event.status === 'upcoming' ? t('eventStatusUpcoming') : t('eventStatusPast')}
          </Badge>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm font-medium text-muted-foreground">{dateLabel}</p>
          <DialogDescription className="pt-2 text-foreground/90">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {event.linkUrl ? (
            <a href={event.linkUrl} target="_blank" rel="noopener noreferrer">
              <Button>{t('eventDetailsCta')}</Button>
            </a>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('eventModalClose')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
