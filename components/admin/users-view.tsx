'use client'

import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Edit3, Trash2, ShieldCheck, TrendingUp, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PaginatedResponse, User, UserStatus } from '@/lib/types'
import { apiClient } from '@/lib/api/client'
import { endpoints } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EditUserDialog } from './edit-user-dialog'

interface UsersViewProps {
  locale: string
}

const PAGE_SIZE = 5

export function UsersView({ locale }: UsersViewProps) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const deferredSearch = useDeferredValue(search)

  const copy = locale === 'es'
    ? {
        badge: 'Gestion de socios',
        title: 'Usuarios de ALEA',
        searchPlaceholder: 'Numero de socio...',
        status: 'Estado de cuenta',
        memberNumber: 'Numero de socio',
        actions: 'Acciones',
        active: 'Activo',
        suspended: 'Suspendido',
        totalMembers: 'Total socios',
        systemSecurity: 'Seguridad del sistema',
        securityBody: 'Los campos de contrasena permanecen bloqueados durante la edicion para respetar el protocolo interno de acceso seguro.',
        deleteTitle: 'Eliminar usuario',
        deleteBody: 'Esta accion eliminara el perfil y la credencial asociada de Supabase.',
        empty: 'No hay usuarios que coincidan con la busqueda actual.',
        showing: 'Mostrando',
        to: 'a',
        of: 'de',
        users: 'usuarios',
        activeThisMonth: '+12 este mes',
      }
    : {
        badge: 'Member management',
        title: 'ALEA Users',
        searchPlaceholder: 'Member number...',
        status: 'Account status',
        memberNumber: 'Member number',
        actions: 'Actions',
        active: 'Active',
        suspended: 'Suspended',
        totalMembers: 'Total members',
        systemSecurity: 'System security',
        securityBody: 'Password fields remain locked during editing to respect the internal secure-access protocol.',
        deleteTitle: 'Delete user',
        deleteBody: 'This action deletes both the profile and its linked Supabase credential.',
        empty: 'No users match the current search.',
        showing: 'Showing',
        to: 'to',
        of: 'of',
        users: 'users',
        activeThisMonth: '+12 this month',
      }

  const usersQuery = useQuery<PaginatedResponse<User>>({
    queryKey: ['admin-users', page, deferredSearch],
    queryFn: () => apiClient.get(
      `${endpoints.users.list}?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(deferredSearch.trim())}`
    ),
  })

  const updateUser = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UserStatus }) =>
      apiClient.put<User>(endpoints.users.byId(id), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingUser(null)
    },
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => apiClient.delete<void>(endpoints.users.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeletingUser(null)
    },
  })

  const users = usersQuery.data?.data ?? []
  const total = usersQuery.data?.total ?? 0
  const totalPages = usersQuery.data?.totalPages ?? 1
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total)

  return (
    <div className="bg-neo-classical min-h-[calc(100vh-5rem)] px-6 pb-24 pt-32 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-primary">
              {copy.badge}
            </p>
            <h1 className="font-cinzel text-4xl tracking-tight text-on-surface md:text-5xl">
              {copy.title}
            </h1>
          </div>

          <div className="group relative w-full md:w-96">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60 transition-colors group-focus-within:text-primary" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={copy.searchPlaceholder}
              className="h-14 rounded-xl border-outline-variant/10 bg-surface-container-low/60 pl-12 text-sm text-foreground shadow-lg shadow-black/20 backdrop-blur-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-xl bg-primary p-8 text-on-primary shadow-xl">
            <div className="relative z-10">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em]">{copy.totalMembers}</h2>
              <p className="mt-4 font-cinzel text-6xl font-bold italic">{total}</p>
              <div className="mt-3 flex items-center gap-2 text-sm text-on-primary/80">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                <span>{copy.activeThisMonth}</span>
              </div>
            </div>
            <Users className="absolute -bottom-8 -right-8 h-40 w-40 rotate-12 text-on-primary/10 transition-transform duration-700 group-hover:rotate-0" aria-hidden="true" />
          </div>

          <div className="relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-high/40 p-8 backdrop-blur-md md:col-span-2">
            <div className="max-w-md">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{copy.systemSecurity}</h2>
              <p className="mt-4 font-cinzel text-2xl leading-tight text-on-surface">
                {copy.securityBody}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-background/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>AES-256 Active</span>
              </div>
            </div>
            <div className="absolute right-8 top-1/2 hidden h-32 w-32 -translate-y-1/2 rounded-full border-4 border-dashed border-primary/10 lg:flex lg:items-center lg:justify-center">
              <ShieldCheck className="h-12 w-12 text-primary/20" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low/40 shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface-container-high/50">
                <tr className="border-b border-outline-variant/10">
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{copy.memberNumber}</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{copy.status}</th>
                  <th className="px-8 py-5 text-right text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{copy.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-primary/5">
                    <td className="px-8 py-6">
                      <span className="font-cinzel text-lg font-bold text-primary">#{user.memberNumber}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full border',
                            user.status === 'active'
                              ? 'border-primary shadow-[0_0_8px_rgba(255,183,123,0.4)]'
                              : 'border-primary-container bg-primary-container/40'
                          )}
                        />
                        <span className={cn(
                          'text-[10px] uppercase tracking-[0.22em]',
                          user.status === 'active' ? 'text-primary/80' : 'text-muted-foreground'
                        )}>
                          {user.status === 'active' ? copy.active : copy.suspended}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="text-primary/70 hover:text-primary" onClick={() => setEditingUser(user)}>
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setDeletingUser(user)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="px-8 py-16 text-center text-sm text-muted-foreground">
              {copy.empty}
            </div>
          )}

          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/10 bg-surface-container-low/60 px-8 py-6 md:flex-row">
            <p className="text-xs uppercase tracking-tight text-muted-foreground">
              {copy.showing} {from} {copy.to} {to} {copy.of} {total} {copy.users}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, page - 2), Math.max(0, page - 2) + 5).map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={pageNumber === page ? 'default' : 'outline'}
                  className="h-10 w-10 px-0"
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <EditUserDialog
        locale={locale}
        open={!!editingUser}
        user={editingUser}
        isSaving={updateUser.isPending}
        onClose={() => setEditingUser(null)}
        onSave={async (status) => {
          if (!editingUser) return
          await updateUser.mutateAsync({ id: editingUser.id, status })
        }}
      />

      <AlertDialog open={!!deletingUser} onOpenChange={(nextOpen) => !nextOpen && setDeletingUser(null)}>
        <AlertDialogContent className="border-outline-variant/10 bg-surface-container-low text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cinzel text-2xl italic">{copy.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant">
              {copy.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                if (deletingUser) {
                  void deleteUser.mutateAsync(deletingUser.id)
                }
              }}
            >
              {deleteUser.isPending ? (locale === 'es' ? 'Eliminando...' : 'Deleting...') : (locale === 'es' ? 'Eliminar' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
