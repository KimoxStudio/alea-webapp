import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { CheckInActivator } from '@/components/check-in/check-in-activator'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkin')
  return { title: `${t('title')} — Alea` }
}

interface CheckInPageProps {
  params: Promise<{ locale: string; tableId: string }>
  searchParams: Promise<{ side?: string }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function CheckInPage({ params, searchParams }: CheckInPageProps) {
  const { locale, tableId } = await params
  const { side: sideParam } = await searchParams

  const VALID_LOCALES = ['en', 'es']
  if (!VALID_LOCALES.includes(locale)) {
    redirect('/')
  }

  if (!UUID_REGEX.test(tableId)) {
    redirect(`/${locale}/rooms`)
  }

  const session = await getSessionFromServerCookies()
  if (!session) {
    redirect(`/${locale}/login?returnUrl=/${locale}/check-in/${tableId}${sideParam === 'inf' ? '?side=inf' : ''}`)
  }

  return (
    <main id="main-content">
      <CheckInActivator tableId={tableId} side={sideParam} />
    </main>
  )
}
