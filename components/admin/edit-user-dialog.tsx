'use client'

import { useEffect, useState } from 'react'
import type { User, UserStatus } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EditUserDialogProps {
  locale: string
  open: boolean
  user: User | null
  isSaving: boolean
  onClose: () => void
  onSave: (status: UserStatus) => Promise<void>
}

export function EditUserDialog({
  locale,
  open,
  user,
  isSaving,
  onClose,
  onSave,
}: EditUserDialogProps) {
  const [status, setStatus] = useState<UserStatus>('active')

  useEffect(() => {
    if (user) {
      setStatus(user.status)
    }
  }, [user])

  const copy = locale === 'es'
    ? {
        title: 'Editar socio',
        description: 'Actualiza el estado de la cuenta sin exponer credenciales sensibles.',
        memberNumber: 'Numero de socio',
        accountStatus: 'Estado de cuenta',
        active: 'Activo',
        suspended: 'Suspendido',
        securityTitle: 'Protocolo interno',
        securityBody: 'Las contrasenas no se editan desde este panel. Cualquier recuperacion debe pasar por el flujo seguro de acceso.',
        save: 'Guardar cambios',
      }
    : {
        title: 'Edit member',
        description: 'Update the account status without exposing sensitive credentials.',
        memberNumber: 'Member number',
        accountStatus: 'Account status',
        active: 'Active',
        suspended: 'Suspended',
        securityTitle: 'Internal protocol',
        securityBody: 'Passwords are not editable from this panel. Any recovery must go through the secure access flow.',
        save: 'Save changes',
      }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="rounded-xl shadow-2xl border-outline-variant/20 bg-surface-container-low text-on-surface sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-3xl text-on-surface mb-2">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-primary mb-2">
              {copy.memberNumber}
            </label>
            <Input value={user?.memberNumber ?? ''} disabled className="p-4 rounded-lg border-outline-variant/20 bg-surface-container-high text-on-surface cursor-not-allowed" />
          </div>

          <div className="space-y-2">
            <label htmlFor="user-status" className="text-[10px] uppercase tracking-widest font-bold text-primary mb-2">
              {copy.accountStatus}
            </label>
            <select
              id="user-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as UserStatus)}
              className="flex w-full rounded-lg border border-outline-variant/20 bg-surface-container-high p-4 text-sm text-on-surface outline-none transition-colors focus:border-primary"
            >
              <option value="active">{copy.active}</option>
              <option value="suspended">{copy.suspended}</option>
            </select>
          </div>

          <div className="rounded-lg border border-error/20 bg-error-container/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-destructive/80">
              {copy.securityTitle}
            </p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">
              {copy.securityBody}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {locale === 'es' ? 'Cancelar' : 'Cancel'}
          </Button>
          <Button onClick={() => onSave(status)} disabled={isSaving} className="hover:shadow-[0_0_20px_rgba(255,183,123,0.3)] transition-all">
            {isSaving ? (locale === 'es' ? 'Guardando...' : 'Saving...') : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
