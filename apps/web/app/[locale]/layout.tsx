import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/lib/i18n/config'
import { AuthProvider } from '@/lib/auth/auth-context'
import { Providers } from '@/lib/providers'
import { Header } from '@/components/layout/header'

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

  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-background antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <AuthProvider>
              <Header locale={locale} />
              <main id="main-content" className="min-h-[calc(100vh-4rem)]">
                {children}
              </main>
            </AuthProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
