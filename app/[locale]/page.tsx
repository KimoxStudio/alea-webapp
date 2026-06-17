import { redirect } from 'next/navigation'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'

interface HomePageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params
  const session = await getSessionFromServerCookies()

  if (session) {
    try {
      await getCurrentUser(session)
      redirect(`/${locale}/rooms`)
    } catch {
      // Ignore stale/invalid session state and redirect to login.
    }
  }

  redirect(`/${locale}/login`)
}
