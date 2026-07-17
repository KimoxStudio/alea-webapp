import 'server-only'

/**
 * lib/auth/session — single seam for Supabase Auth session/user operations.
 *
 * This is an F0 abstraction seam (see Linear KIM-393..422, Supabase→Neon migration):
 * it introduces indirection with zero behavior change so a later phase (F1)
 * can swap the underlying implementation (Supabase Auth -> Auth.js) without
 * touching call sites again. For F0 this is intentionally a thin wrapper
 * around today's Supabase Auth method calls — not a redesign.
 *
 * Unlike `lib/db` (the sibling seam for Postgres access), this module does
 * NOT wrap the Supabase client *factories* — call sites still create their
 * client via `lib/supabase/server` (a user-scoped client for session reads
 * / sign-in, or the admin client for user provisioning), because that same
 * client is often also used for unrelated `.from(...)` table access in the
 * calling file. This seam wraps the actual Supabase Auth *method* calls
 * (`.auth.getUser()`, `.auth.signInWithPassword()`, `.auth.signOut()`,
 * `.auth.admin.*`) so those call sites go through a stable, named API
 * instead of reaching into `.auth` directly.
 *
 * NOTE: `lib/auth/auth-context.tsx` is an unrelated CLIENT-SIDE React
 * context provider — do not confuse it with this server-side seam.
 */

/** Minimal shape of the Supabase Auth user this seam exposes to callers. */
export type AuthUser = {
  id: string
}

// ---------------------------------------------------------------------------
// Session read
// ---------------------------------------------------------------------------

type GetUserClient = {
  auth: {
    getUser: () => Promise<{ data: { user: AuthUser | null }; error: unknown }>
  }
}

/**
 * Resolves the currently authenticated Supabase Auth user for the given
 * client (user-scoped server client or route-handler client). Returns
 * `null` on any error or when there is no authenticated user — callers
 * should not distinguish between "no session" and "auth error" here, same
 * as the previous inline behavior.
 */
export async function getAuthUser(client: GetUserClient): Promise<AuthUser | null> {
  const { data, error } = await client.auth.getUser()

  if (error || !data.user) {
    return null
  }

  return data.user
}

// ---------------------------------------------------------------------------
// Sign-in / sign-out
// ---------------------------------------------------------------------------

export type PasswordCredentials = {
  email: string
  password: string
}

export type SignInWithPasswordResult = {
  data: { user: AuthUser | null }
  error: { message: string } | null
}

type SignInClient = {
  auth: {
    signInWithPassword: (credentials: PasswordCredentials) => Promise<SignInWithPasswordResult>
  }
}

/** Signs in with member-number-derived email + password. */
export async function signInWithPassword(
  client: SignInClient,
  credentials: PasswordCredentials,
): Promise<SignInWithPasswordResult> {
  return client.auth.signInWithPassword(credentials)
}

export type SignOutResult = { error: { message: string } | null }

type SignOutClient = {
  auth: {
    signOut: () => Promise<SignOutResult>
  }
}

/** Signs out the current session on the given client. */
export async function signOut(client: SignOutClient): Promise<SignOutResult> {
  return client.auth.signOut()
}

// ---------------------------------------------------------------------------
// Admin user management (Supabase Auth admin API)
// ---------------------------------------------------------------------------

export type CreateAuthUserInput = {
  email: string
  password: string
  email_confirm?: boolean
}

export type CreateAuthUserResult = {
  data: { user: AuthUser | null }
  error: { message: string } | null
}

export type UpdateAuthUserAttributes = {
  email?: string
  password?: string
  email_confirm?: boolean
}

export type AuthAdminOperationResult = { error: unknown }

type AuthAdminClient = {
  auth: {
    admin: {
      createUser: (input: CreateAuthUserInput) => Promise<CreateAuthUserResult>
      deleteUser: (id: string) => Promise<AuthAdminOperationResult>
      updateUserById: (id: string, attributes: UpdateAuthUserAttributes) => Promise<AuthAdminOperationResult>
    }
  }
}

/** Creates a Supabase Auth user (admin-only). */
export async function createAuthUser(
  admin: AuthAdminClient,
  input: CreateAuthUserInput,
): Promise<CreateAuthUserResult> {
  return admin.auth.admin.createUser(input)
}

/** Deletes a Supabase Auth user by id (admin-only). */
export async function deleteAuthUser(admin: AuthAdminClient, id: string): Promise<AuthAdminOperationResult> {
  return admin.auth.admin.deleteUser(id)
}

/** Updates a Supabase Auth user's attributes (email, password, email_confirm) (admin-only). */
export async function updateAuthUserById(
  admin: AuthAdminClient,
  id: string,
  attributes: UpdateAuthUserAttributes,
): Promise<AuthAdminOperationResult> {
  return admin.auth.admin.updateUserById(id, attributes)
}
