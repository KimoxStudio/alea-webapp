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

export default async function CheckInPage({ params, searchParams }: CheckInPageProps) {
  const { locale, tableId } = await params
  const { side: sideParam } = await searchParams

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
