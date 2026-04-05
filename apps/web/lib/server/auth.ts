import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient, createSupabaseServerClient } from '@/lib/supabase/server'
export { enforceSameOriginForMutation } from '@/lib/server/security'

export type SessionUser = {
  id: string
  role: 'member' | 'admin'
}

type SessionClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }, error: unknown }>
  }
  from: (...args: unknown[]) => {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: () => Promise<{ data: { id: string; role: 'member' | 'admin' } | null, error: unknown }>
      }
    }
  }
}

type RouteSessionResult = {
  session: SessionUser | null
  applyCookies: (response: NextResponse) => NextResponse
}

type AuthContext = {
  session: SessionUser
  applyCookies: (response: NextResponse) => NextResponse
}

async function getSessionUser(client: SessionClient) {
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    return null
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return null
  }

  return {
    id: profile.id,
    role: profile.role,
  } satisfies SessionUser
}

export async function getSessionFromRequest(request: NextRequest): Promise<RouteSessionResult> {
  const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request)
  return {
    session: await getSessionUser(supabase as unknown as SessionClient),
    applyCookies,
  }
}

export async function getSessionFromServerCookies(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient()
  return getSessionUser(supabase as unknown as SessionClient)
}

export async function requireAuth(request: NextRequest): Promise<AuthContext | NextResponse> {
  const { session, applyCookies } = await getSessionFromRequest(request)
  if (!session) {
    return applyCookies(NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }))
  }
  return { session, applyCookies }
}

export async function requireAdmin(request: NextRequest): Promise<AuthContext | NextResponse> {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  if (auth.session.role !== 'admin') {
    return auth.applyCookies(NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 }))
  }
  return auth
}
