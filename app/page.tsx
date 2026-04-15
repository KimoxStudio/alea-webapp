import { redirect } from 'next/navigation'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'

export default async function RootPage() {
  const session = await getSessionFromServerCookies()

  if (session) {
    try {
      await getCurrentUser(session)
      redirect('/es/rooms')
    } catch {
      // Ignore stale/invalid session state and send the user to login.
    }
  }

  redirect('/es/login')
}
