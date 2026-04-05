import type { User } from '@/lib/types'
import type { SessionUser } from '@/lib/server/auth'
import { serviceError } from '@/lib/server/service-error'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

type ProfileRow = Tables<'profiles'>
type PublicProfileRow = Pick<ProfileRow, 'id' | 'member_number' | 'role' | 'created_at' | 'updated_at'>
type AuthCredentialRow = Pick<ProfileRow, 'id' | 'member_number' | 'email' | 'role' | 'created_at' | 'updated_at'>
const PUBLIC_PROFILE_COLUMNS = 'id, member_number, role, created_at, updated_at' as const

// Auth-only columns: email is needed solely to resolve Supabase Auth credentials.
// It is not part of the application profile model (issue #39).
const AUTH_CREDENTIAL_COLUMNS = 'id, member_number, email, role, created_at, updated_at' as const

type PublicProfileLookupColumn = 'id' | 'member_number'
type AuthCredentialLookupColumn = 'id' | 'member_number'
type PublicProfileMaybeSingleResult = Promise<{
  data: PublicProfileRow | null
  error: unknown
}>
type AuthCredentialMaybeSingleResult = Promise<{
  data: AuthCredentialRow | null
  error: unknown
}>
type PublicProfilesTableClient = {
  select: (columns: typeof PUBLIC_PROFILE_COLUMNS) => {
    eq: (column: PublicProfileLookupColumn, value: string) => {
      maybeSingle: () => PublicProfileMaybeSingleResult
    }
  }
}
type AuthCredentialTableClient = {
  select: (columns: typeof AUTH_CREDENTIAL_COLUMNS) => {
    eq: (column: AuthCredentialLookupColumn, value: string) => {
      maybeSingle: () => AuthCredentialMaybeSingleResult
    }
  }
}
type ProfileLookupClient = {
  from: (table: 'profiles') => unknown
}

type AuthClient = {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
    signOut: () => Promise<{ error: { message: string } | null }>
  }
}

function getProfilesTable(client: ProfileLookupClient) {
  return client.from('profiles') as PublicProfilesTableClient
}

function getAuthCredentialTable(client: ProfileLookupClient) {
  return client.from('profiles') as AuthCredentialTableClient
}

async function getPublicProfileBy(
  client: ProfileLookupClient,
  column: PublicProfileLookupColumn,
  value: string,
) {
  const { data, error } = await getProfilesTable(client)
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq(column, value)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data
}

async function getAuthCredentialProfileBy(
  client: ProfileLookupClient,
  column: AuthCredentialLookupColumn,
  value: string,
) {
  const { data, error } = await getAuthCredentialTable(client)
    .select(AUTH_CREDENTIAL_COLUMNS)
    .eq(column, value)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data
}

function toPublicUser(profile: PublicProfileRow): User {
  return {
    id: profile.id,
    memberNumber: profile.member_number,
    role: profile.role,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

async function getAuthCredentialByMemberNumber(memberNumber: string) {
  const admin = createSupabaseServerAdminClient()
  return getAuthCredentialProfileBy(admin, 'member_number', memberNumber)
}

export async function login(
  input: { identifier?: unknown; password?: unknown },
  client?: AuthClient,
): Promise<User> {
  const identifier = String(input.identifier ?? '').trim()
  const password = String(input.password ?? '')

  if (!identifier || !password) {
    serviceError('Identifier and password are required', 400)
  }

  // Resolve the auth credential profile by member number (email login not supported).
  const credentialProfile = await getAuthCredentialByMemberNumber(identifier)

  if (!credentialProfile) {
    serviceError('Invalid credentials', 401)
  }

  if (!credentialProfile.email) {
    // Profile has no email set — cannot authenticate via Supabase Auth.
    serviceError('Invalid credentials', 401)
  }

  const supabase = client ?? await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentialProfile.email,
    password,
  })

  if (error || !data.user) {
    serviceError('Invalid credentials', 401)
  }

  if (data.user.id !== credentialProfile.id) {
    // Guard against profile/auth drift: the authenticated Supabase user must match
    // the profile resolved by member number.
    serviceError('Invalid credentials', 401)
  }

  return toPublicUser(credentialProfile)
}

export async function register(
  _input: unknown,
  _client?: AuthClient,
): Promise<User> {
  serviceError('Registration is currently unavailable', 403)
}

async function getSessionScopedProfile(id: string, client?: ProfileLookupClient) {
  const supabase = client ?? await createSupabaseServerClient()
  return getPublicProfileBy(supabase, 'id', id)
}

export async function getCurrentUser(
  session: SessionUser | null,
  client?: ProfileLookupClient,
): Promise<User> {
  if (!session) {
    serviceError('Unauthorized', 401)
  }

  const profile = await getSessionScopedProfile(session.id, client)
  if (!profile) {
    serviceError('Unauthorized', 401)
  }

  return toPublicUser(profile)
}

export async function logout() {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return { success: true }
}

export async function logoutWithClient(client: AuthClient) {
  const { error } = await client.auth.signOut()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return { success: true }
}
