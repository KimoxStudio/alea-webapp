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
  variant: 'upcoming' | 'past'
  onOpenChange: (open: boolean) => void
}

export function EventDetailsDialog({ event, locale, variant, onOpenChange }: EventDetailsDialogProps) {
  const t = useTranslations('home')

  if (!event) return null

  const title = locale === 'en' ? event.titleEn : event.titleEs
  const description = (locale === 'en' ? event.descriptionEn : event.descriptionEs) ??
    (locale === 'en' ? event.blurbEn : event.blurbEs)
  const dateLabel = formatClubEventDate(event, locale)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <Badge variant={event.status === 'upcoming' ? 'available' : 'secondary'} className="mb-2 w-fit">
            {event.status === 'upcoming' ? t('eventStatus.upcoming') : t('eventStatus.past')}
          </Badge>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm font-medium text-muted-foreground">{dateLabel}</p>
          <DialogDescription className="whitespace-pre-line pt-2 text-foreground/90">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {variant === 'upcoming' && event.linkUrl && (
            <a href={event.linkUrl} target="_blank" rel="noopener noreferrer">
              <Button>{t('modal.signup')}</Button>
            </a>
          )}
          <a href={t('business.mapsUrl')} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">{t('modal.directions')}</Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
