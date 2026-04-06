'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Plus, ChevronDown, ChevronRight, Loader2, DoorOpen, Table2 } from 'lucide-react'
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
  useAdminRooms,
  useAdminUpdateRoom,
  useAdminCreateRoom,
  useAdminRoomTables,
  useAdminCreateTable,
} from '@/lib/hooks/use-admin'
import type { Room, GameTable } from '@/lib/types'

// Table type badge styling
const tableTypeBadge: Record<string, 'outline' | 'partial' | 'available'> = {
  small: 'outline',
  large: 'partial',
  removable_top: 'available',
}

// Sub-component: expanded room tables list + create table form
function RoomTablesPanel({ room }: { room: Room }) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const tt = useTranslations('tables')

  const { data: tables, isLoading } = useAdminRoomTables(room.id)
  const createTable = useAdminCreateTable()

  const [showCreateTable, setShowCreateTable] = useState(false)
  const [tableName, setTableName] = useState('')
  const [tableType, setTableType] = useState<'small' | 'large' | 'removable_top'>('small')

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault()
    if (!tableName.trim()) return
    await createTable.mutateAsync({ roomId: room.id, data: { name: tableName.trim(), type: tableType } })
    setTableName('')
    setTableType('small')
    setShowCreateTable(false)
  }

  return (
    <div className="mt-4 ml-6 pl-4 border-l-2 border-primary/20 space-y-4">
      {/* Table list */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-3/4 rounded-md" />
        </div>
      ) : (tables ?? []).length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Table2 className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
          {t('noTables')}
        </div>
      ) : (
        <div className="space-y-1">
          {(tables as GameTable[]).map((table) => (
            <div
              key={table.id}
              className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-background-secondary/40 hover:bg-background-secondary/70 transition-colors border border-border/30"
            >
              <div className="flex items-center gap-2">
                <Table2 className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">{table.name}</span>
              </div>
              <Badge variant={tableTypeBadge[table.type] ?? 'outline'} className="text-xs">
                {table.type.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Create table form */}
      {showCreateTable ? (
        <form onSubmit={handleCreateTable} className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-cinzel font-semibold text-primary/80 uppercase tracking-wider mb-2">
            {t('createTable')}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`table-name-${room.id}`} className="text-xs text-muted-foreground">
              {t('tableName')}
            </Label>
            <Input
              id={`table-name-${room.id}`}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={t('tableName')}
              required
              className="h-8 text-sm bg-background-secondary border-border focus:border-primary/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`table-type-${room.id}`} className="text-xs text-muted-foreground">
              {t('tableType')}
            </Label>
            <Select value={tableType} onValueChange={(v) => setTableType(v as typeof tableType)}>
              <SelectTrigger id={`table-type-${room.id}`} className="h-8 text-sm bg-background-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{tt('small')}</SelectItem>
                <SelectItem value="large">{tt('large')}</SelectItem>
                <SelectItem value="removable_top">{tt('removable_top')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={createTable.isPending} className="h-8">
              {createTable.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t('creating')}</>
              ) : tc('save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateTable(false)}
              className="h-8 border-border"
            >
              {tc('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateTable(true)}
          className="gap-1.5 border-primary/30 text-primary/80 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('createTable')}
        </Button>
      )}
    </div>
  )
}

// Sub-component: single room row
function RoomRow({ room }: { room: Room }) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')

  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(room.name)
  const [editDesc, setEditDesc] = useState(room.description ?? '')

  const updateRoom = useAdminUpdateRoom()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await updateRoom.mutateAsync({
      id: room.id,
      data: { name: editName.trim() || room.name, description: editDesc.trim() || undefined },
    })
    setEditing(false)
  }

  return (
    <div className="rpg-card overflow-hidden">
      {/* Room header row */}
      <div className="flex items-center justify-between gap-2 px-4 py-3.5">
        <button
          type="button"
          className="flex items-center gap-2.5 text-left hover:text-primary transition-colors group/toggle min-w-0"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`room-tables-${room.id}`}
        >
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded text-muted-foreground group-hover/toggle:text-primary transition-colors">
            {expanded
              ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
              : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <span className="font-cinzel font-semibold text-foreground group-hover/toggle:text-primary transition-colors block truncate">
              {room.name}
            </span>
            {room.description && (
              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                {room.description}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-secondary/60 border border-border/50">
            <Table2 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground">
              {room.tableCount} {t('tables')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('editRoom')}
            onClick={() => {
              setEditing(true)
              setEditName(room.name)
              setEditDesc(room.description ?? '')
            }}
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Expandable tables panel */}
      {expanded && (
        <div
          id={`room-tables-${room.id}`}
          className="border-t border-border/50 px-4 pb-4 bg-background-secondary/20"
        >
          <RoomTablesPanel room={room} />
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-cinzel text-gradient-gold">{t('editRoom')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`room-name-edit-${room.id}`} className="text-sm text-muted-foreground font-medium">
                {t('roomName')}
              </Label>
              <Input
                id={`room-name-edit-${room.id}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`room-desc-edit-${room.id}`} className="text-sm text-muted-foreground font-medium">
                {t('roomDescription')}
              </Label>
              <Input
                id={`room-desc-edit-${room.id}`}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} className="border-border">
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={updateRoom.isPending} className="min-w-[80px]">
                {updateRoom.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('saving')}</>
                ) : tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function RoomsSection() {
  const t = useTranslations('admin')
  const tc = useTranslations('common')

  const { data: rooms, isLoading } = useAdminRooms()
  const createRoom = useAdminCreateRoom()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTableCount, setNewTableCount] = useState('0')

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    const tableCount = Math.max(0, parseInt(newTableCount, 10) || 0)
    await createRoom.mutateAsync({ name: newName.trim(), description: newDesc.trim() || undefined, tableCount })
    setNewName('')
    setNewDesc('')
    setNewTableCount('0')
    setShowCreate(false)
  }

  return (
    <section aria-labelledby="rooms-heading" className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 border border-primary/20">
            <DoorOpen className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <h2 id="rooms-heading" className="font-cinzel text-xl font-semibold text-foreground">
            {t('roomManagement')}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="gap-1.5 border-primary/30 text-primary/80 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('createRoom')}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rpg-card px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (rooms ?? []).length === 0 ? (
        <div className="rpg-card p-12 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
            <DoorOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="font-cinzel text-sm font-semibold text-muted-foreground">{t('noRooms')}</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors underline-offset-4 hover:underline"
            >
              {t('createRoom')} &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(rooms ?? []).map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </div>
      )}

      {/* Create Room Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20">
                <DoorOpen className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <DialogTitle className="font-cinzel text-gradient-gold">{t('createRoom')}</DialogTitle>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreateRoom} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-room-name" className="text-sm text-muted-foreground font-medium">
                {t('roomName')}
              </Label>
              <Input
                id="new-room-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-room-desc" className="text-sm text-muted-foreground font-medium">
                {t('roomDescription')}
              </Label>
              <Input
                id="new-room-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-room-count" className="text-sm text-muted-foreground font-medium">
                {t('tableCount')}
              </Label>
              <Input
                id="new-room-count"
                type="number"
                min="0"
                value={newTableCount}
                onChange={(e) => setNewTableCount(e.target.value)}
                className="bg-background-secondary border-border focus:border-primary/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="border-border">
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={createRoom.isPending} className="min-w-[80px]">
                {createRoom.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('creating')}</>
                ) : tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
