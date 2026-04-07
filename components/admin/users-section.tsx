'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { DiceLoader } from '@/components/ui/dice-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAdminUsers, useAdminUpdateUser, useAdminDeleteUser } from '@/lib/hooks/use-admin'
import type { User } from '@/lib/types'

type UserRole = 'member' | 'admin'

interface EditState {
  memberNumber: string
  role: UserRole
  isActive: boolean
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  const t = useTranslations('admin')
  if (!isActive) {
    return (
      <Badge className="border-orange-500/40 bg-orange-900/20 text-orange-400">
        {t('suspended')}
      </Badge>
    )
  }
  return (
    <Badge className="border-emerald-500/40 bg-emerald-900/20 text-emerald-400">
      {t('active')}
    </Badge>
  )
}

export function UsersSection() {
  const t = useTranslations('admin')
  const tc = useTranslations('common')

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [editUser, setEditUser] = useState<User | null>(null)
  const [editState, setEditState] = useState<EditState>({ memberNumber: '', role: 'member', isActive: true })
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  const { data, isLoading, isError } = useAdminUsers(page, 10, search)
  const updateMutation = useAdminUpdateUser()
  const deleteMutation = useAdminDeleteUser()

  function openEdit(user: User) {
    setEditState({
      memberNumber: user.memberNumber,
      role: user.role,
      isActive: user.isActive,
    })
    setEditUser(user)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  function handleSaveEdit() {
    if (!editUser) return
    updateMutation.mutate({
      id: editUser.id,
      data: {
        memberNumber: editState.memberNumber,
        role: editState.role,
        is_active: editState.isActive,
      },
    }, {
      onSuccess: () => setEditUser(null),
    })
  }

  function handleDeleteConfirm() {
    if (!deleteUser) return
    deleteMutation.mutate(deleteUser.id, {
      onSuccess: () => setDeleteUser(null),
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('searchUsers')}
            className="pl-9"
            aria-label={t('searchUsers')}
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          {tc('search')}
        </Button>
      </form>

      {isLoading && (
        <div className="flex justify-center py-8">
          <DiceLoader size="sm" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive-foreground py-4">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">{tc('error')}</span>
        </div>
      )}

      {data && data.data.length === 0 && (
        <p className="text-center text-muted-foreground py-8">{t('noUsers')}</p>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('memberNumber')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tc('email')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('role')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('joinDate')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{user.memberNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {t(user.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(user)}
                          aria-label={t('editUser')}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUser(user)}
                          aria-label={t('deleteUser')}
                          className="text-destructive-foreground hover:bg-destructive/15"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {tc('showing')} {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} {tc('of')} {data.total} {tc('results')}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {tc('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {tc('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editUserTitle')}</DialogTitle>
            <DialogDescription>
              {editUser?.memberNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-member-number">{t('memberNumber')}</Label>
              <Input
                id="edit-member-number"
                value={editState.memberNumber}
                onChange={(e) => setEditState((s) => ({ ...s, memberNumber: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role">{t('role')}</Label>
              <Select
                value={editState.role}
                onValueChange={(v) => setEditState((s) => ({ ...s, role: v as UserRole }))}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t('member')}</SelectItem>
                  <SelectItem value="admin">{t('admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-is-active">{t('status')}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="edit-is-active"
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-emerald-500"
                  checked={editState.isActive}
                  onChange={(e) => setEditState((s) => ({ ...s, isActive: e.target.checked }))}
                />
                <span className="text-sm text-muted-foreground">
                  {editState.isActive ? t('active') : t('suspended')}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending || !editState.memberNumber.trim()}
            >
              {updateMutation.isPending ? (
                <DiceLoader size="sm" className="mr-2" hideRole />
              ) : null}
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteUser')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteUserConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <DiceLoader size="sm" className="mr-2" hideRole />
              ) : null}
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
