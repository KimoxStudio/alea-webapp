'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarRange, Plus, Pencil, Trash2 } from 'lucide-react'
import { DiceLoader } from '@/components/ui/dice-loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useAdminEvents,
  useAdminCreateEvent,
  useAdminUpdateEvent,
  useAdminDeleteEvent,
  useAdminRooms,
} from '@/lib/hooks/use-admin'
import type { AdminEvent } from '@/lib/types'

const NONE_ROOM = '__none__'

interface EventFormState {
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  roomId: string
}

function emptyForm(): EventFormState {
  return { title: '', description: '', date: '', startTime: '', endTime: '', roomId: NONE_ROOM }
}

function formFromEvent(event: AdminEvent): EventFormState {
  return {
    title: event.title,
    description: event.description ?? '',
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    roomId: event.roomBlocks[0]?.roomId ?? NONE_ROOM,
  }
}

// Dialog for create/edit
function EventFormDialog({
  open,
  onOpenChange,
  dialogId,
  title,
  form,
  setForm,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dialogId: string
  title: string
  form: EventFormState
  setForm: (f: EventFormState) => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
}) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const { data: rooms } = useAdminRooms()

  function field(key: keyof EventFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value })
  }

  const id = (suffix: string) => `${dialogId}-${suffix}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20">
              <CalendarRange className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <DialogTitle className="font-cinzel text-gradient-gold">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={id('title')} className="text-sm text-muted-foreground font-medium">
              {t('events.title')}
            </Label>
            <Input
              id={id('title')}
              value={form.title}
              onChange={field('title')}
              required
              className="bg-background-secondary border-border focus:border-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id('description')} className="text-sm text-muted-foreground font-medium">
              {t('events.description')}
            </Label>
            <Input
              id={id('description')}
              value={form.description}
              onChange={field('description')}
              className="bg-background-secondary border-border focus:border-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id('room')} className="text-sm text-muted-foreground font-medium">
              {t('events.room')}
            </Label>
            <Select value={form.roomId} onValueChange={(v) => setForm({ ...form, roomId: v })}>
              <SelectTrigger id={id('room')} className="bg-background-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_ROOM}>—</SelectItem>
                {(rooms ?? []).map((room) => (
                  <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor={id('date')} className="text-sm text-muted-foreground font-medium">
                {tc('date')}
              </Label>
              <Input
                id={id('date')}
                type="date"
                value={form.date}
                onChange={field('date')}
                required
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id('start')} className="text-sm text-muted-foreground font-medium">
                {t('events.startTime')}
              </Label>
              <Input
                id={id('start')}
                type="time"
                value={form.startTime}
                onChange={field('startTime')}
                required
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id('end')} className="text-sm text-muted-foreground font-medium">
                {t('events.endTime')}
              </Label>
              <Input
                id={id('end')}
                type="time"
                value={form.endTime}
                onChange={field('endTime')}
                required
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-[80px]">
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <DiceLoader size="sm" hideRole />
                  <span>{t('saving')}</span>
                </span>
              ) : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Conflict warning delete dialog
function DeleteEventDialog({
  open,
  onOpenChange,
  event,
  onConfirm,
  isPending,
  conflictError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: AdminEvent | null
  onConfirm: () => void
  isPending: boolean
  conflictError: string | null
}) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-destructive">{t('events.deleteEvent')}</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('deleteEventConfirm', { title: event?.title ?? '' })}
          </p>
          {conflictError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive font-medium">{t('events.conflictWarning')}</p>
              <p className="text-xs text-destructive/80 mt-1">{conflictError}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            {tc('cancel')}
          </Button>
          {!conflictError && (
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isPending}
              className="min-w-[80px]"
            >
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <DiceLoader size="sm" hideRole />
                  <span>{tc('loading')}</span>
                </span>
              ) : tc('delete')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Single event row
function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: AdminEvent
  onEdit: (event: AdminEvent) => void
  onDelete: (event: AdminEvent) => void
}) {
  const tc = useTranslations('common')
  const { data: rooms } = useAdminRooms()
  const hasRoom = event.roomBlocks.length > 0
  const roomName = hasRoom
    ? (rooms ?? []).find((r) => r.id === event.roomBlocks[0].roomId)?.name ?? event.roomBlocks[0].roomId
    : null

  return (
    <div className="rpg-card px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="font-cinzel font-semibold text-foreground truncate">{event.title}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground truncate">{event.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-xs font-mono">
              {event.date}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {event.startTime.slice(0, 5)} – {event.endTime.slice(0, 5)}
            </span>
            {hasRoom && roomName && (
              <Badge variant="partial" className="text-xs">
                {roomName}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label={tc('edit')}
            onClick={() => onEdit(event)}
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={tc('delete')}
            onClick={() => onDelete(event)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function EventsSection() {
  const t = useTranslations('admin')

  const { data: events, isLoading } = useAdminEvents()
  const createEvent = useAdminCreateEvent()
  const updateEvent = useAdminUpdateEvent()
  const deleteEvent = useAdminDeleteEvent()

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<EventFormState>(emptyForm())

  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null)
  const [editForm, setEditForm] = useState<EventFormState>(emptyForm())

  const [deletingEvent, setDeletingEvent] = useState<AdminEvent | null>(null)
  const [deleteConflictError, setDeleteConflictError] = useState<string | null>(null)

  function openEdit(event: AdminEvent) {
    setEditingEvent(event)
    setEditForm(formFromEvent(event))
  }

  function openDelete(event: AdminEvent) {
    setDeletingEvent(event)
    setDeleteConflictError(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createEvent.mutateAsync({
      title: createForm.title.trim(),
      description: createForm.description.trim() || null,
      date: createForm.date,
      startTime: createForm.startTime,
      endTime: createForm.endTime,
      roomId: createForm.roomId === NONE_ROOM ? null : createForm.roomId,
    })
    setCreateForm(emptyForm())
    setShowCreate(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEvent) return
    await updateEvent.mutateAsync({
      id: editingEvent.id,
      data: {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        date: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        roomId: editForm.roomId === NONE_ROOM ? null : editForm.roomId,
      },
    })
    setEditingEvent(null)
  }

  async function handleDelete() {
    if (!deletingEvent) return
    try {
      await deleteEvent.mutateAsync(deletingEvent.id)
      setDeletingEvent(null)
      setDeleteConflictError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? String(err)
      setDeleteConflictError(msg)
    }
  }

  return (
    <section aria-labelledby="events-heading" className="space-y-5">
      {/* Section header */}
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
          onClick={() => { setCreateForm(emptyForm()); setShowCreate(true) }}
          className="gap-1.5 border-primary/30 text-primary/80 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('events.createEvent')}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rpg-card px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-3 w-60 rounded" />
              </div>
              <Skeleton className="h-8 w-16 rounded flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (events ?? []).length === 0 ? (
        <div className="rpg-card p-12 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
            <CalendarRange className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="font-cinzel text-sm font-semibold text-muted-foreground">{t('events.noEvents')}</p>
            <button
              type="button"
              onClick={() => { setCreateForm(emptyForm()); setShowCreate(true) }}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
            >
              {t('events.createEvent')} &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(events ?? []).map((event) => (
            <EventRow key={event.id} event={event} onEdit={openEdit} onDelete={openDelete} />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <EventFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        dialogId="create-event"
        title={t('events.createEvent')}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreate}
        isPending={createEvent.isPending}
      />

      {/* Edit Dialog */}
      <EventFormDialog
        open={!!editingEvent}
        onOpenChange={(open) => { if (!open) setEditingEvent(null) }}
        dialogId="edit-event"
        title={t('events.editEvent')}
        form={editForm}
        setForm={setEditForm}
        onSubmit={handleUpdate}
        isPending={updateEvent.isPending}
      />

      {/* Delete Dialog */}
      <DeleteEventDialog
        open={!!deletingEvent}
        onOpenChange={(open) => { if (!open) { setDeletingEvent(null); setDeleteConflictError(null) } }}
        event={deletingEvent}
        onConfirm={handleDelete}
        isPending={deleteEvent.isPending}
        conflictError={deleteConflictError}
      />
    </section>
  )
}
