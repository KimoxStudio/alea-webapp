import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase PKCE auth callback handler.
 * This route is called by Supabase after OAuth or magic link authentication.
 * The full implementation is wired in M3 (auth cutover).
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    // TODO (M3): Exchange code for session using createSupabaseServerClient()
    // const supabase = await createSupabaseServerClient()
    // await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
