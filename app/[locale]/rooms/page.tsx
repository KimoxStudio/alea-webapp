import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { RoomsView } from '@/components/rooms/rooms-view'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('rooms')
  return { title: `${t('title')} — Alea` }
}

interface RoomsPageProps {
  params: Promise<{ locale: string }>
}

export default async function RoomsPage({ params }: RoomsPageProps) {
  const { locale } = await params
  const session = await getSessionFromServerCookies()
  if (!session) {
    redirect(`/${locale}/login`)
  }

  try {
    await getCurrentUser(session)
  } catch {
    redirect(`/${locale}/login`)
  }

  return <RoomsView />
}
