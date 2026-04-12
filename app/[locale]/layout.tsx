import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/lib/i18n/config'
import { AuthProvider } from '@/lib/auth/auth-context'
import { Providers } from '@/lib/providers'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { NavigationProgress } from '@/components/ui/navigation-progress'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'

export const metadata: Metadata = {
  title: 'Alea — Asociacion Cultural de Juegos',
  description: 'Gestion de salas y reservas para la Asociacion Cultural Alea',
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params

  if (!locales.includes(locale as 'es' | 'en')) {
    notFound()
  }

  const messages = await getMessages()
  const session = await getSessionFromServerCookies()
  const initialUser = session ? await getCurrentUser(session) : null

  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-background antialiased flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <AuthProvider initialUser={initialUser}>
              <NavigationProgress />
              <Suspense fallback={null}>
                <Header locale={locale} />
              </Suspense>
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <Footer locale={locale} />
            </AuthProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
