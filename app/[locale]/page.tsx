import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'
import { listClubEvents } from '@/lib/server/club-events-service'
import { LandingView } from '@/components/landing/landing-view'

interface HomePageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })

  return { title: `Alea — ${t('heroTitle')}` }
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params
  const session = await getSessionFromServerCookies()

  if (session) {
    try {
      await getCurrentUser(session)
      redirect(`/${locale}/rooms`)
    } catch {
      // Ignore stale/invalid session state and fall through to the public landing page.
    }
  }

  const { upcoming, past } = await listClubEvents()

  return <LandingView locale={locale} upcomingEvents={upcoming} pastEvents={past} />
}
