import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Sword, Shield } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: `${t('login')} -- Alea` }
}

interface LoginPageProps {
  params: Promise<{ locale: string }>
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params
  const session = await getSessionFromServerCookies()
  if (session) {
    let authenticated = false
    try {
      await getCurrentUser(session)
      authenticated = true
    } catch {
      // Ignore stale/invalid session state and render the login form.
    }
    if (authenticated) {
      redirect(`/${locale}/rooms`)
    }
  }
  const t = await getTranslations('auth')

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4" aria-hidden="true">
            <Shield className="h-8 w-8 text-primary" />
            <Sword className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-cinzel text-3xl font-bold text-gradient-gold mb-2">{t('login')}</h1>
          <p className="text-muted-foreground">{t('loginSubtitle')}</p>
        </div>
        <div className="rpg-card p-8">
          <LoginForm locale={locale} />
          <p className="mt-6 text-center text-sm text-muted-foreground">{t('loginHelp')}</p>
        </div>
      </div>
    </div>
  )
}
