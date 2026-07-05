// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { toPublicUser } from '@/lib/server/profile-mappers'
import type { Tables } from '@/lib/supabase/types'

type ProfileRow = Tables<'profiles'>

describe('profile mappers', () => {
  describe('toPublicUser', () => {
    it('maps a complete profile row to User with all fields', () => {
      const profile: ProfileRow = {
        id: 'user-123',
        member_number: '100001',
        full_name: 'John Doe',
        auth_email: 'john@alea.club',
        email: 'john.doe@personal.com',
        phone: '+34 123 456 789',
        role: 'member',
        is_active: true,
        active_from: '2024-01-15T10:00:00.000Z',
        no_show_count: 2,
        blocked_until: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-20T14:30:00.000Z',
      }

      const user = toPublicUser(profile)

      expect(user).toEqual({
        id: 'user-123',
        memberNumber: '100001',
        fullName: 'John Doe',
        email: 'john.doe@personal.com',
        phone: '+34 123 456 789',
        role: 'member',
        isActive: true,
        activeFrom: '2024-01-15T10:00:00.000Z',
        noShowCount: 2,
        blockedUntil: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-06-20T14:30:00.000Z',
      })
    })

    it('handles null/optional fields correctly', () => {
      const profile: ProfileRow = {
        id: 'user-456',
        member_number: '100002',
        full_name: null,
        auth_email: 'user@alea.club',
        email: null,
        phone: null,
        role: 'admin',
        is_active: false,
        active_from: null,
        no_show_count: 0,
        blocked_until: null,
        created_at: '2024-02-01T00:00:00.000Z',
        updated_at: '2024-02-01T00:00:00.000Z',
      }

      const user = toPublicUser(profile)

      expect(user).toEqual({
        id: 'user-456',
        memberNumber: '100002',
        fullName: null,
        email: null,
        phone: null,
        role: 'admin',
        isActive: false,
        activeFrom: null,
        noShowCount: 0,
        blockedUntil: null,
        createdAt: '2024-02-01T00:00:00.000Z',
        updatedAt: '2024-02-01T00:00:00.000Z',
      })
    })

    it('preserves blocked_until when set', () => {
      const blockDate = '2024-07-01T00:00:00.000Z'
      const profile: ProfileRow = {
        id: 'user-blocked',
        member_number: '100003',
        full_name: 'Blocked User',
        auth_email: 'blocked@alea.club',
        email: 'blocked@personal.com',
        phone: null,
        role: 'member',
        is_active: true,
        active_from: '2024-01-01T00:00:00.000Z',
        no_show_count: 5,
        blocked_until: blockDate,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-20T14:30:00.000Z',
      }

      const user = toPublicUser(profile)

      expect(user.blockedUntil).toBe(blockDate)
    })

    it('converts snake_case column names to camelCase', () => {
      const profile: ProfileRow = {
        id: 'test-user',
        member_number: '999999',
        full_name: 'Test Name',
        auth_email: 'test@alea.club',
        email: 'test@personal.com',
        phone: '555-1234',
        role: 'member',
        is_active: true,
        active_from: '2024-06-01T00:00:00.000Z',
        no_show_count: 1,
        blocked_until: null,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T12:00:00.000Z',
      }

      const user = toPublicUser(profile)

      // Verify all snake_case fields are converted to camelCase
      expect(user).toHaveProperty('memberNumber', profile.member_number)
      expect(user).toHaveProperty('fullName', profile.full_name)
      expect(user).toHaveProperty('isActive', profile.is_active)
      expect(user).toHaveProperty('activeFrom', profile.active_from)
      expect(user).toHaveProperty('noShowCount', profile.no_show_count)
      expect(user).toHaveProperty('blockedUntil', profile.blocked_until)
      expect(user).toHaveProperty('createdAt', profile.created_at)
      expect(user).toHaveProperty('updatedAt', profile.updated_at)
    })

    it('handles admin role', () => {
      const profile: ProfileRow = {
        id: 'admin-user',
        member_number: '100000',
        full_name: 'Admin User',
        auth_email: 'admin@alea.club',
        email: 'admin@personal.com',
        phone: null,
        role: 'admin',
        is_active: true,
        active_from: '2024-01-01T00:00:00.000Z',
        no_show_count: 0,
        blocked_until: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }

      const user = toPublicUser(profile)

      expect(user.role).toBe('admin')
    })

    it('handles zero and negative no_show_count values', () => {
      const profileZero: ProfileRow = {
        id: 'user-zero',
        member_number: '100010',
        full_name: 'Zero Shows',
        auth_email: 'zero@alea.club',
        email: null,
        phone: null,
        role: 'member',
        is_active: true,
        active_from: '2024-06-01T00:00:00.000Z',
        no_show_count: 0,
        blocked_until: null,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const user = toPublicUser(profileZero)

      expect(user.noShowCount).toBe(0)
    })

    it('handles long no_show_count values', () => {
      const profile: ProfileRow = {
        id: 'user-many',
        member_number: '100011',
        full_name: 'Many Shows',
        auth_email: 'many@alea.club',
        email: null,
        phone: null,
        role: 'member',
        is_active: false,
        active_from: null,
        no_show_count: 10,
        blocked_until: null,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const user = toPublicUser(profile)

      expect(user.noShowCount).toBe(10)
    })

    it('preserves active_from as nullable', () => {
      const profileWithActiveFrom: ProfileRow = {
        id: 'user-active',
        member_number: '100012',
        full_name: 'Active User',
        auth_email: 'active@alea.club',
        email: null,
        phone: null,
        role: 'member',
        is_active: true,
        active_from: '2025-01-01T00:00:00.000Z',
        no_show_count: 0,
        blocked_until: null,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const user = toPublicUser(profileWithActiveFrom)

      expect(user.activeFrom).toBe('2025-01-01T00:00:00.000Z')

      const profileWithoutActiveFrom: ProfileRow = {
        ...profileWithActiveFrom,
        active_from: null,
      }

      const user2 = toPublicUser(profileWithoutActiveFrom)

      expect(user2.activeFrom).toBeNull()
    })
  })
})
