import 'server-only'
import type { User } from '@/lib/types'
import type { Tables } from '@/lib/supabase/types'

type ProfileRow = Tables<'profiles'>

export type PublicProfileRow = Pick<
  ProfileRow,
  | 'id'
  | 'member_number'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'role'
  | 'is_active'
  | 'active_from'
  | 'no_show_count'
  | 'blocked_until'
  | 'created_at'
  | 'updated_at'
>

export function toPublicUser(profile: PublicProfileRow): User {
  return {
    id: profile.id,
    memberNumber: profile.member_number,
    fullName: profile.full_name ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    role: profile.role,
    isActive: profile.is_active,
    activeFrom: profile.active_from ?? null,
    noShowCount: profile.no_show_count,
    blockedUntil: profile.blocked_until ?? null,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}
