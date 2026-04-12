import type { User } from '@/lib/types'
import type { SessionUser } from '@/lib/server/auth'
import { serviceError } from '@/lib/server/service-error'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'
import { registerServerSchema } from '@/lib/validations/auth'

type ProfileRow = Tables<'profiles'>
type PublicProfileRow = Pick<ProfileRow, 'id' | 'member_number' | 'role' | 'is_active' | 'no_show_count' | 'blocked_until' | 'created_at' | 'updated_at'>
type AuthCredentialRow = Pick<ProfileRow, 'id' | 'member_number' | 'email' | 'role' | 'is_active' | 'no_show_count' | 'blocked_until' | 'created_at' | 'updated_at'>
const PUBLIC_PROFILE_COLUMNS = 'id, member_number, role, is_active, no_show_count, blocked_until, created_at, updated_at' as const

// Auth-only columns: email is needed solely to resolve Supabase Auth credentials.
// It is not part of the public user model (issue #39) but IS included for admin-facing user data.
const AUTH_CREDENTIAL_COLUMNS = 'id, member_number, email, role, is_active, no_show_count, blocked_until, created_at, updated_at' as const

type PublicProfileLookupColumn = 'id' | 'member_number'
type AuthCredentialLookupColumn = 'id' | 'member_number' | 'email'
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
    isActive: profile.is_active,
    noShowCount: profile.no_show_count,
    blockedUntil: profile.blocked_until ?? null,
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

  if (credentialProfile.is_active === false) {
    // Suspended users cannot sign in.
    serviceError('Your account is suspended. Contact an administrator to reactivate it.', 403)
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
  input: unknown,
  sessionClient?: AuthClient,
): Promise<User> {
  const parsed = registerServerSchema.safeParse(input)
  if (!parsed.success) {
    serviceError('Invalid registration details', 400)
  }

  const { memberNumber, password } = parsed.data

  // Use the full admin client (ReturnType<typeof createSupabaseServerAdminClient>) so
  // both auth.admin and .from('profiles') are available without unsafe casts.
  const adminClient = createSupabaseServerAdminClient()

  // Check whether the member number is already taken by an existing profile.
  const existing = await getAuthCredentialProfileBy(adminClient, 'member_number', memberNumber)
  if (existing) {
    serviceError('This member number is already registered', 409)
  }

  // Derive a deterministic internal email from the member number so Supabase Auth
  // can work with email/password credentials without exposing real emails.
  const email = `${memberNumber}@members.alea.internal`

  // Create the Supabase Auth user. The on_auth_user_created trigger will immediately
  // INSERT a profiles row with a placeholder member_number.
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    serviceError('Failed to create account', 500)
  }

  const userId = authData.user.id

  // UPDATE the trigger-created profile row with the real values.
  // We use update() instead of insert() because the on_auth_user_created trigger
  // already inserted a row for this user id with a placeholder member_number.
  const { data: profileData, error: profileError } = await adminClient
    .from('profiles')
    .update({ member_number: memberNumber, email, role: 'member', is_active: true })
    .eq('id', userId)
    .select(PUBLIC_PROFILE_COLUMNS)
    .maybeSingle()

  if (profileError) {
    // Unique constraint violation on member_number — concurrent registration with the
    // same member number; clean up the orphaned auth user.
    if ((profileError as { code?: string }).code === '23505') {
      await adminClient.auth.admin.deleteUser(userId)
      serviceError('This member number is already registered', 409)
    }
    await adminClient.auth.admin.deleteUser(userId)
    serviceError('Failed to create user profile', 500)
  }

  if (!profileData) {
    await adminClient.auth.admin.deleteUser(userId)
    serviceError('Failed to create user profile', 500)
  }

  // Sign the user in to establish a session. Registration succeeded regardless of
  // whether auto-login works — the user can always log in manually.
  const supabase = sessionClient ?? await createSupabaseServerClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    // Non-fatal: profile was created successfully. User can log in separately.
  }

  return toPublicUser(profileData)
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
