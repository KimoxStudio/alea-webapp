import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { UsersView } from '@/components/admin/users-view'
import { getSessionFromServerCookies } from '@/lib/server/auth'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin')
  return { title: `${t('dashboard')} — Alea` }
}

interface AdminPageProps {
  params: Promise<{ locale: string }>
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params
  const session = await getSessionFromServerCookies()

  if (!session) {
    redirect(`/${locale}/login`)
  }

  if (session.role !== 'admin') {
    redirect(`/${locale}/rooms`)
  }

  return <UsersView locale={locale} />
}
