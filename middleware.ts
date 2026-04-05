import createMiddleware from 'next-intl/middleware'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, type NextResponse } from 'next/server'
import { ensureCsrfCookie, getSupabaseCookieOptions } from './lib/server/security'
import { locales, defaultLocale } from './lib/i18n/config'
import { getSupabaseUrl, getSupabasePublishableKey } from './lib/supabase/config.client'

const handleI18nRouting = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

function createMiddlewareSupabaseClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )
}

export default async function middleware(request: NextRequest) {
  const response = handleI18nRouting(request)
  const supabase = createMiddlewareSupabaseClient(request, response)

  await supabase.auth.getUser()

  return ensureCsrfCookie(request, response)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
