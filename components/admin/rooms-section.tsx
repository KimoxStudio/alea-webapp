'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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

// Sub-component: expanded room tables list + create table form
function RoomTablesPanel({ room }: { room: Room }) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')

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
    <div className="mt-3 ml-4 pl-4 border-l border-border/50 space-y-3">
      {isLoading ? (
        <Skeleton className="h-8 w-full rounded" />
      ) : (tables ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTables')}</p>
      ) : (
        <div className="space-y-1">
          {(tables as GameTable[]).map((table) => (
            <div key={table.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/20">
              <span className="font-medium">{table.name}</span>
              <span className="text-muted-foreground text-xs">— {table.type}</span>
            </div>
          ))}
        </div>
      )}

      {showCreateTable ? (
        <form onSubmit={handleCreateTable} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor={`table-name-${room.id}`}>{t('tableName')}</Label>
            <Input
              id={`table-name-${room.id}`}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={t('tableName')}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`table-type-${room.id}`}>{t('tableType')}</Label>
            <Select value={tableType} onValueChange={(v) => setTableType(v as typeof tableType)}>
              <SelectTrigger id={`table-type-${room.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="removable_top">Removable Top</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createTable.isPending}>
              {createTable.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" aria-hidden="true" />{t('creating')}</>
                : tc('save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateTable(false)}
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
          className="gap-1"
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
    <div className="rpg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left hover:text-primary transition-colors"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          <span className="font-cinzel font-semibold">{room.name}</span>
          <span className="text-xs text-muted-foreground">({room.tableCount} {t('tables')})</span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('editRoom')}
          onClick={() => { setEditing(true); setEditName(room.name); setEditDesc(room.description ?? '') }}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {room.description && !editing && (
        <p className="text-sm text-muted-foreground ml-6">{room.description}</p>
      )}

      {expanded && <RoomTablesPanel room={room} />}

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cinzel">{t('editRoom')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`room-name-edit-${room.id}`}>{t('roomName')}</Label>
              <Input
                id={`room-name-edit-${room.id}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`room-desc-edit-${room.id}`}>{t('roomDescription')}</Label>
              <Input
                id={`room-desc-edit-${room.id}`}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>{tc('cancel')}</Button>
              <Button type="submit" disabled={updateRoom.isPending}>
                {updateRoom.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />{t('saving')}</>
                  : tc('save')}
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
    <section aria-labelledby="rooms-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="rooms-heading" className="font-cinzel text-xl font-semibold text-foreground">
          {t('roomManagement')}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('createRoom')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (rooms ?? []).length === 0 ? (
        <div className="rpg-card p-8 text-center text-muted-foreground">
          {t('noRooms')}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cinzel">{t('createRoom')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRoom} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-room-name">{t('roomName')}</Label>
              <Input
                id="new-room-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-room-desc">{t('roomDescription')}</Label>
              <Input
                id="new-room-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-room-count">{t('tableCount')}</Label>
              <Input
                id="new-room-count"
                type="number"
                min="0"
                value={newTableCount}
                onChange={(e) => setNewTableCount(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{tc('cancel')}</Button>
              <Button type="submit" disabled={createRoom.isPending}>
                {createRoom.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />{t('creating')}</>
                  : tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
