'use client'

import { useState } from 'react'
import type { User } from '@/lib/types'

interface UsersSectionProps {
  users: User[]
  onUpdateUser?: (id: string, payload: { role?: 'member' | 'admin'; is_active?: boolean }) => Promise<void>
  onDeleteUser?: (id: string) => Promise<void>
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Activo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
      Suspendido
    </span>
  )
}

interface ActiveToggleProps {
  isActive: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

function ActiveToggle({ isActive, onChange, disabled }: ActiveToggleProps) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="sr-only"
        checked={isActive}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={[
          'h-5 w-9 rounded-full transition-colors',
          isActive ? 'bg-green-500' : 'bg-orange-400',
          disabled ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            isActive ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </div>
      <span className="text-sm text-muted-foreground">
        {isActive ? 'Activo' : 'Suspendido'}
      </span>
    </label>
  )
}

export function UsersSection({ users, onUpdateUser, onDeleteUser }: UsersSectionProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<'member' | 'admin'>('member')
  const [editIsActive, setEditIsActive] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)

  function openEdit(user: User) {
    setEditingUser(user)
    setEditRole(user.role)
    setEditIsActive(user.isActive)
  }

  function closeEdit() {
    setEditingUser(null)
  }

  async function handleSave() {
    if (!editingUser || !onUpdateUser) return
    setSaving(true)
    try {
      await onUpdateUser(editingUser.id, {
        role: editRole,
        is_active: editIsActive,
      })
      closeEdit()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Socio</th>
            <th className="pb-2 pr-4 font-medium">Rol</th>
            <th className="pb-2 pr-4 font-medium">Estado</th>
            <th className="pb-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b last:border-0">
              <td className="py-3 pr-4 font-mono">{user.memberNumber}</td>
              <td className="py-3 pr-4 capitalize">{user.role}</td>
              <td className="py-3 pr-4">
                <StatusBadge isActive={user.isActive} />
              </td>
              <td className="py-3">
                <button
                  type="button"
                  className="mr-2 rounded px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => openEdit(user)}
                >
                  Editar
                </button>
                {onDeleteUser && (
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteUser(user.id)}
                  >
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-base font-semibold">
              Editar usuario #{editingUser.memberNumber}
            </h2>

            <div className="mb-4 space-y-2">
              <label className="block text-sm font-medium">Rol</label>
              <select
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'member' | 'admin')}
              >
                <option value="member">Socio</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="mb-6 space-y-2">
              <label className="block text-sm font-medium">Estado</label>
              <ActiveToggle
                isActive={editIsActive}
                onChange={setEditIsActive}
                disabled={saving}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded px-4 py-2 text-sm hover:bg-muted"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
