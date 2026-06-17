'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarRange, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { DiceLoader } from '@/components/ui/dice-loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  useAdminRooms,
  useAdminEvents,
  useAdminCreateEvent,
  useAdminUpdateEvent,
  useAdminDeleteEvent,
} from '@/lib/hooks/use-admin'
import type { AdminEvent, CreateEventRequest } from '@/lib/types'
import { formatDate, formatTime } from '@/lib/utils'

type ScheduleDraft = { date: string; startTime: string; endTime: string }

const emptySchedule = (): ScheduleDraft => ({
  date: new Date().toISOString().slice(0, 10),
  startTime: '10:00',
  endTime: '12:00',
})

function eventToDraft(event?: AdminEvent): CreateEventRequest {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    roomIds: event?.roomIds ?? [],
    schedules: event?.schedules.map((schedule) => ({
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    })) ?? [emptySchedule()],
  }
}

export function EventsSection() {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const { data: events, isLoading } = useAdminEvents()
  const { data: rooms } = useAdminRooms()
  const createEvent = useAdminCreateEvent()
  const updateEvent = useAdminUpdateEvent()
  const deleteEvent = useAdminDeleteEvent()

  const [editing, setEditing] = useState<AdminEvent | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CreateEventRequest>(eventToDraft())

  const roomNames = useMemo(() => {
    return new Map((rooms ?? []).map((room) => [room.id, room.name]))
  }, [rooms])

  function openCreate() {
    setEditing(null)
    setDraft(eventToDraft())
    setOpen(true)
  }

  function openEdit(event: AdminEvent) {
    setEditing(event)
    setDraft(eventToDraft(event))
    setOpen(true)
  }

  function toggleRoom(roomId: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      roomIds: checked
        ? [...current.roomIds, roomId]
        : current.roomIds.filter((id) => id !== roomId),
    }))
  }

  function updateSchedule(index: number, patch: Partial<ScheduleDraft>) {
    setDraft((current) => ({
      ...current,
      schedules: current.schedules.map((schedule, i) => i === index ? { ...schedule, ...patch } : schedule),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      await updateEvent.mutateAsync({ id: editing.id, data: draft })
    } else {
      await createEvent.mutateAsync(draft)
    }
    setOpen(false)
  }

  const saving = createEvent.isPending || updateEvent.isPending

  return (
    <section aria-labelledby="events-heading" className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 border border-primary/20">
            <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <h2 id="events-heading" className="font-cinzel text-xl font-semibold text-foreground">
            {t('eventManagement')}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={openCreate}
          className="gap-1.5 border-primary/30 text-primary/80 hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('createEvent')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rpg-card px-4 py-4 space-y-3">
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="h-4 w-72 rounded" />
              <Skeleton className="h-8 w-full rounded" />
            </div>
          ))}
        </div>
      ) : (events ?? []).length === 0 ? (
        <div className="rpg-card p-12 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
            <CalendarRange className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="font-cinzel text-sm font-semibold text-muted-foreground">{t('noEvents')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(events ?? []).map((event) => (
            <article key={event.id} className="rpg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-cinzel font-semibold text-foreground truncate">{event.title}</h3>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(event)} aria-label={t('editEvent')}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteEvent.mutate(event.id)}
                    aria-label={t('deleteEvent')}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border/50 bg-background-secondary/30 p-3">
                  <p className="text-xs font-cinzel font-semibold uppercase text-muted-foreground mb-2">{t('blockedRooms')}</p>
                  <div className="flex flex-wrap gap-2">
                    {event.roomIds.map((roomId) => (
                      <span key={roomId} className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-xs text-primary">
                        {roomNames.get(roomId) ?? roomId.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border/50 bg-background-secondary/30 p-3">
                  <p className="text-xs font-cinzel font-semibold uppercase text-muted-foreground mb-2">{t('eventSchedules')}</p>
                  <div className="space-y-1.5">
                    {event.schedules.map((schedule) => (
                      <p key={schedule.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
                        <span className="text-foreground">{formatDate(schedule.date)}</span>
                        <span>{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-cinzel text-gradient-gold">
              {editing ? t('editEvent') : t('createEvent')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-title">{t('eventTitle')}</Label>
                <Input
                  id="event-title"
                  value={draft.title}
                  onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
                  required
                  className="bg-background-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-description">{t('eventDescription')}</Label>
                <Input
                  id="event-description"
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                  className="bg-background-secondary border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('blockedRooms')}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(rooms ?? []).map((room) => (
                  <label key={room.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background-secondary/30 px-3 py-2 text-sm">
                    <Checkbox
                      checked={draft.roomIds.includes(room.id)}
                      onCheckedChange={(checked) => toggleRoom(room.id, checked === true)}
                    />
                    <span>{room.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>{t('eventSchedules')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft((current) => ({ ...current, schedules: [...current.schedules, emptySchedule()] }))}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('addSchedule')}
                </Button>
              </div>
              <div className="space-y-2">
                {draft.schedules.map((schedule, index) => (
                  <div key={index} className="grid gap-2 rounded-md border border-border/60 bg-background-secondary/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input
                      type="date"
                      value={schedule.date}
                      onChange={(e) => updateSchedule(index, { date: e.target.value })}
                      required
                      className="bg-background border-border"
                    />
                    <Input
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => updateSchedule(index, { startTime: e.target.value })}
                      required
                      className="bg-background border-border"
                    />
                    <Input
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => updateSchedule(index, { endTime: e.target.value })}
                      required
                      className="bg-background border-border"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('deleteSchedule')}
                      onClick={() => setDraft((current) => ({
                        ...current,
                        schedules: current.schedules.filter((_, i) => i !== index),
                      }))}
                      disabled={draft.schedules.length === 1}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border">
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving || draft.roomIds.length === 0 || draft.schedules.length === 0}>
                {saving ? (
                  <span className="inline-flex items-center gap-2"><DiceLoader size="sm" hideRole /><span>{t('saving')}</span></span>
                ) : tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
