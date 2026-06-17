'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarRange, Plus, Pencil, Trash2, PlusCircle, MinusCircle } from 'lucide-react'
import { DiceLoader } from '@/components/ui/dice-loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  useAdminPreviewEventConflicts,
} from '@/lib/hooks/use-admin'
import type { AdminEvent, AdminEventSchedule } from '@/lib/types'

const NONE_ROOM = '__none__'

// ---------------------------------------------------------------------------
// Per-schedule entry form state
// ---------------------------------------------------------------------------
interface ScheduleEntry {
  id: string
  date: string
  startTime: string
  endTime: string
  roomId: string
  allDay: boolean
}

function emptySchedule(): ScheduleEntry {
  return { id: crypto.randomUUID(), date: '', startTime: '', endTime: '', roomId: NONE_ROOM, allDay: false }
}

function scheduleFromBlock(b: AdminEventSchedule): ScheduleEntry {
  return {
    id: b.id ?? crypto.randomUUID(),
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    roomId: b.roomId ?? NONE_ROOM,
    allDay: b.allDay,
  }
}

// ---------------------------------------------------------------------------
// Top-level event form state
// ---------------------------------------------------------------------------
interface EventFormState {
  title: string
  description: string
  schedules: ScheduleEntry[]
}

function emptyForm(): EventFormState {
  return { title: '', description: '', schedules: [emptySchedule()] }
}

function formFromEvent(event: AdminEvent): EventFormState {
  const schedules =
    event.schedules.length > 0
      ? event.schedules.map(scheduleFromBlock)
      : [emptySchedule()]
  return {
    title: event.title,
    description: event.description ?? '',
    schedules,
  }
}

// ---------------------------------------------------------------------------
// ScheduleRow — one date/room/time entry in the form
// ---------------------------------------------------------------------------
function ScheduleRow({
  index,
  entry,
  canRemove,
  onChange,
  onRemove,
  dialogId,
}: {
  index: number
  entry: ScheduleEntry
  canRemove: boolean
  onChange: (updated: ScheduleEntry) => void
  onRemove: () => void
  dialogId: string
}) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const { data: rooms } = useAdminRooms()
  const id = (suffix: string) => `${dialogId}-sched-${index}-${suffix}`

  function field(key: keyof ScheduleEntry) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...entry, [key]: e.target.value })
  }

  return (
    <div className="rounded-lg border border-border bg-background-secondary/40 p-3 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t('events.scheduleDay', { n: index + 1 })}
        </span>
        {canRemove && (
          <button
            type="button"
            aria-label={t('events.removeSchedule')}
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <MinusCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Room */}
      <div className="space-y-1.5">
        <Label htmlFor={id('room')} className="text-xs text-muted-foreground font-medium">
          {t('events.room')}
        </Label>
        <Select
          value={entry.roomId}
          onValueChange={(v) => onChange({ ...entry, roomId: v })}
        >
          <SelectTrigger id={id('room')} className="bg-background-secondary border-border h-8 text-sm">
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

      {/* All-day toggle */}
      <div className="flex items-start gap-2">
        <Checkbox
          id={id('all-day')}
          checked={entry.allDay}
          onCheckedChange={(checked) => onChange({
            ...entry,
            allDay: checked === true,
            startTime: checked === true ? '' : entry.startTime,
            endTime: checked === true ? '' : entry.endTime,
          })}
          className="mt-0.5"
        />
        <Label htmlFor={id('all-day')} className="text-xs text-foreground font-medium leading-tight">
          {t('events.allDay')}
        </Label>
      </div>

      {/* Date + optional times */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor={id('date')} className="text-xs text-muted-foreground font-medium">
            {tc('date')}
          </Label>
          <Input
            id={id('date')}
            type="date"
            value={entry.date}
            onChange={field('date')}
            required
            className="bg-background-secondary border-border focus:border-primary/50 h-8 text-sm"
          />
        </div>
        {!entry.allDay && (
          <>
            <div className="space-y-1">
              <Label htmlFor={id('start')} className="text-xs text-muted-foreground font-medium">
                {t('events.startTime')}
              </Label>
              <Input
                id={id('start')}
                type="time"
                step={3600}
                value={entry.startTime}
                onChange={field('startTime')}
                required={!entry.allDay}
                className="bg-background-secondary border-border focus:border-primary/50 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={id('end')} className="text-xs text-muted-foreground font-medium">
                {t('events.endTime')}
              </Label>
              <Input
                id={id('end')}
                type="time"
                step={3600}
                value={entry.endTime}
                onChange={field('endTime')}
                required={!entry.allDay}
                className="bg-background-secondary border-border focus:border-primary/50 h-8 text-sm"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EventFormDialog — create / edit
// ---------------------------------------------------------------------------
function EventFormDialog({
  open,
  onOpenChange,
  dialogId,
  title,
  form,
  setForm,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dialogId: string
  title: string
  form: EventFormState
  setForm: (f: EventFormState) => void
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  error?: string | null
}) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')

  function updateSchedule(index: number, updated: ScheduleEntry) {
    const schedules = form.schedules.map((s, i) => (i === index ? updated : s))
    setForm({ ...form, schedules })
  }

  function addSchedule() {
    setForm({ ...form, schedules: [...form.schedules, emptySchedule()] })
  }

  function removeSchedule(index: number) {
    const schedules = form.schedules.filter((_, i) => i !== index)
    setForm({ ...form, schedules })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20">
              <CalendarRange className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <DialogTitle className="font-cinzel text-gradient-gold">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor={`${dialogId}-title`} className="text-sm text-muted-foreground font-medium">
              {t('events.title')}
            </Label>
            <Input
              id={`${dialogId}-title`}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="bg-background-secondary border-border focus:border-primary/50"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor={`${dialogId}-description`} className="text-sm text-muted-foreground font-medium">
              {t('events.description')}
            </Label>
            <Input
              id={`${dialogId}-description`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-background-secondary border-border focus:border-primary/50"
            />
          </div>

          {/* Schedules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">
                {t('events.schedules')}
              </span>
              <button
                type="button"
                onClick={addSchedule}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                aria-label={t('events.addSchedule')}
              >
                <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {t('events.addSchedule')}
              </button>
            </div>
            <div className="space-y-3">
              {form.schedules.map((entry, i) => (
                <ScheduleRow
                  key={entry.id}
                  index={i}
                  entry={entry}
                  canRemove={form.schedules.length > 1}
                  onChange={(updated) => updateSchedule(i, updated)}
                  onRemove={() => removeSchedule(i)}
                  dialogId={dialogId}
                />
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
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

// ---------------------------------------------------------------------------
// DeleteEventDialog
// ---------------------------------------------------------------------------
function DeleteEventDialog({
  open,
  onOpenChange,
  event,
  onConfirm,
  isPending,
  deleteError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: AdminEvent | null
  onConfirm: () => void
  isPending: boolean
  deleteError: string | null
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
          <p className="text-sm text-muted-foreground">
            {t('events.deleteWarning')}
          </p>
          {deleteError && (
            <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive font-medium">{t('events.deleteError')}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            {tc('cancel')}
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Confirm-cancel-reservations dialog (shown before create/update when conflicts exist)
function CancelReservationsDialog({
  open,
  onOpenChange,
  conflictCount,
  onConfirm,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictCount: number
  onConfirm: () => void
  isPending: boolean
}) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-destructive">
            {t('events.cancelReservationsTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            {t('events.cancelReservationsWarning', { n: conflictCount })}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            {tc('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="min-w-[120px]"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <DiceLoader size="sm" hideRole />
                <span>{t('saving')}</span>
              </span>
            ) : t('events.confirmCancelReservations')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// EventRow — list item
// ---------------------------------------------------------------------------
function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: AdminEvent
  onEdit: (event: AdminEvent) => void
  onDelete: (event: AdminEvent) => void
}) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const { data: rooms } = useAdminRooms()
  const schedules = event.schedules.length > 0 ? event.schedules : []
  const isMultiDay = schedules.length > 1

  return (
    <div className="rpg-card px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="font-cinzel font-semibold text-foreground truncate">{event.title}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground truncate">{event.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {/* Date range badge */}
            {isMultiDay ? (
              <Badge variant="outline" className="text-xs font-mono">
                {schedules[0].date} – {schedules[schedules.length - 1].date}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-mono">
                {event.date}
              </Badge>
            )}

            {/* Time or all-day */}
            {schedules.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {schedules[0].allDay
                  ? t('events.allDay')
                  : `${schedules[0].startTime.slice(0, 5)} – ${schedules[0].endTime.slice(0, 5)}`}
              </span>
            )}

            {/* Room(s) — deduplicated at the data level before rendering */}
            {[...new Set(schedules.filter((s) => s.roomId).map((s) => s.roomId as string))].map((roomId) => {
              const roomName = (rooms ?? []).find((r) => r.id === roomId)?.name ?? roomId
              return (
                <Badge key={roomId} variant="partial" className="text-xs">
                  {roomName}
                </Badge>
              )
            })}

            {/* Multi-day indicator */}
            {isMultiDay && (
              <Badge variant="outline" className="text-xs">
                {t('events.multiDay', { n: schedules.length })}
              </Badge>
            )}

            {/* All-day indicator */}
            {event.allDay && !isMultiDay && (
              <Badge variant="outline" className="text-xs">
                {t('events.allDay')}
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

// ---------------------------------------------------------------------------
// EventsSection — main export
// ---------------------------------------------------------------------------

// Pending submit state — holds the payload and action until confirmation
interface PendingSubmit {
  action: 'create' | 'update'
  createPayload?: Parameters<ReturnType<typeof useAdminCreateEvent>['mutateAsync']>[0]
  updatePayload?: Parameters<ReturnType<typeof useAdminUpdateEvent>['mutateAsync']>[0]
}

export function EventsSection() {
  const t = useTranslations('admin')

  const { data: events, isLoading } = useAdminEvents()
  const createEvent = useAdminCreateEvent()
  const updateEvent = useAdminUpdateEvent()
  const deleteEvent = useAdminDeleteEvent()
  const previewConflicts = useAdminPreviewEventConflicts()

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<EventFormState>(emptyForm())

  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null)
  const [editForm, setEditForm] = useState<EventFormState>(emptyForm())

  const [deletingEvent, setDeletingEvent] = useState<AdminEvent | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Confirmation dialog state for reservation cancellation
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(null)
  const [conflictCount, setConflictCount] = useState(0)

  function openEdit(event: AdminEvent) {
    setEditingEvent(event)
    setEditForm(formFromEvent(event))
  }

  function openDelete(event: AdminEvent) {
    setDeletingEvent(event)
    setDeleteError(null)
  }

  /** Convert form schedules to the API payload shape */
  function buildSchedulesPayload(form: EventFormState) {
    return form.schedules.map((s) => ({
      date: s.date,
      startTime: s.allDay ? undefined : s.startTime,
      endTime: s.allDay ? undefined : s.endTime,
      roomId: s.roomId === NONE_ROOM ? null : s.roomId,
      allDay: s.allDay,
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)

    const payload = {
      title: createForm.title.trim(),
      description: createForm.description.trim() || null,
      schedules: buildSchedulesPayload(createForm),
    }

    try {
      const preview = await previewConflicts.mutateAsync({ schedules: buildSchedulesPayload(createForm) })
      if (preview.total > 0) {
        setConflictCount(preview.total)
        setPendingSubmit({ action: 'create', createPayload: payload })
        return
      }
    } catch {
      // If preview fails, surface error and stop — do not silently proceed
      setCreateError('Failed to check for reservation conflicts. Please try again.')
      return
    }

    await executeCreate(payload)
  }

  async function executeCreate(payload: Parameters<ReturnType<typeof useAdminCreateEvent>['mutateAsync']>[0]) {
    try {
      await createEvent.mutateAsync(payload)
      setCreateForm(emptyForm())
      setShowCreate(false)
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? String(err)
      setCreateError(msg)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEvent) return
    setUpdateError(null)

    const payload = {
      id: editingEvent.id,
      data: {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        schedules: buildSchedulesPayload(editForm),
      },
    }

    try {
      const preview = await previewConflicts.mutateAsync({ schedules: buildSchedulesPayload(editForm) })
      if (preview.total > 0) {
        setConflictCount(preview.total)
        setPendingSubmit({ action: 'update', updatePayload: payload })
        return
      }
    } catch {
      setUpdateError('Failed to check for reservation conflicts. Please try again.')
      return
    }

    await executeUpdate(payload)
  }

  async function executeUpdate(payload: Parameters<ReturnType<typeof useAdminUpdateEvent>['mutateAsync']>[0]) {
    try {
      await updateEvent.mutateAsync(payload)
      setEditingEvent(null)
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? String(err)
      setUpdateError(msg)
    }
  }

  async function handleConfirmSave() {
    if (!pendingSubmit) return
    setPendingSubmit(null)
    if (pendingSubmit.action === 'create' && pendingSubmit.createPayload) {
      await executeCreate(pendingSubmit.createPayload)
    } else if (pendingSubmit.action === 'update' && pendingSubmit.updatePayload) {
      await executeUpdate(pendingSubmit.updatePayload)
    }
  }

  async function handleDelete() {
    if (!deletingEvent) return
    try {
      await deleteEvent.mutateAsync(deletingEvent.id)
      setDeletingEvent(null)
      setDeleteError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? String(err)
      setDeleteError(msg)
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
        onOpenChange={(open) => { setShowCreate(open); if (!open) setCreateError(null) }}
        dialogId="create-event"
        title={t('events.createEvent')}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreate}
        isPending={createEvent.isPending}
        error={createError}
      />

      {/* Edit Dialog */}
      <EventFormDialog
        open={!!editingEvent}
        onOpenChange={(open) => { if (!open) { setEditingEvent(null); setUpdateError(null) } }}
        dialogId="edit-event"
        title={t('events.editEvent')}
        form={editForm}
        setForm={setEditForm}
        onSubmit={handleUpdate}
        isPending={updateEvent.isPending}
        error={updateError}
      />

      {/* Delete Dialog */}
      <DeleteEventDialog
        open={!!deletingEvent}
        onOpenChange={(open) => { if (!open) { setDeletingEvent(null); setDeleteError(null) } }}
        event={deletingEvent}
        onConfirm={handleDelete}
        isPending={deleteEvent.isPending}
        deleteError={deleteError}
      />

      {/* Cancel Reservations Confirmation Dialog */}
      <CancelReservationsDialog
        open={!!pendingSubmit}
        onOpenChange={(open) => { if (!open) setPendingSubmit(null) }}
        conflictCount={conflictCount}
        onConfirm={handleConfirmSave}
        isPending={createEvent.isPending || updateEvent.isPending}
      />
    </section>
  )
}
