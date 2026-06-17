import { redirect } from 'next/navigation'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'

export default async function RootPage() {
  const session = await getSessionFromServerCookies()

  let authenticated = false
  if (session) {
    try {
      await getCurrentUser(session)
      authenticated = true
    } catch {
      // Ignore stale/invalid session state and send the user to login.
    }
  }

  redirect(authenticated ? '/es/rooms' : '/es/login')
}
