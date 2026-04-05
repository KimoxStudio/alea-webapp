import type { User } from '@/lib/types'
import type { SessionUser } from '@/lib/server/auth'
import { serviceError } from '@/lib/server/service-error'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

type ProfileRow = Tables<'profiles'>
const PUBLIC_PROFILE_COLUMNS = 'id, member_number, email, role, created_at, updated_at'

type AuthClient = {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
    signOut: () => Promise<{ error: { message: string } | null }>
  }
}

type ProfileLookupClient = {
  from: (table: 'profiles') => {
    select: (columns: string) => {
      eq: (column: 'id', value: string) => {
        maybeSingle: () => Promise<{ data: ProfileRow | null; error: { message: string } | null }>
      }
    }
  }
}

function toPublicUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    memberNumber: profile.member_number,
    email: profile.email,
    role: profile.role,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

async function getProfileById(id: string) {
  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data
}

async function getProfileByEmail(email: string) {
  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data
}

async function getProfileByMemberNumber(memberNumber: string) {
  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('member_number', memberNumber)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data
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

  const profile = identifier.includes('@')
    ? await getProfileByEmail(identifier.toLowerCase())
    : await getProfileByMemberNumber(identifier)

  if (!profile) {
    serviceError('Invalid credentials', 401)
  }

  const supabase = client ?? await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (error || !data.user) {
    serviceError('Invalid credentials', 401)
  }

  return toPublicUser(profile)
}

export async function register(
  input: { memberNumber?: unknown; email?: unknown; password?: unknown },
  _client?: AuthClient,
): Promise<User> {
  const memberNumber = String(input.memberNumber ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')

  if (!memberNumber || !email || !password) {
    serviceError('Member number, email and password are required', 400)
  }
  if (password.length < 12) {
    serviceError('Password must be at least 12 characters', 400)
  }

  serviceError('Registration is currently unavailable', 403)
}

async function getSessionScopedProfile(id: string, client?: ProfileLookupClient) {
  const supabase = client ?? await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data
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

  return toPublicUser(profile as ProfileRow)
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
