import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Sword, Shield } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: `${t('login')} -- Alea` }
}

interface LoginPageProps {
  params: Promise<{ locale: string }>
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params
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
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">{t('noAccount')}</span>{' '}
            <Link href={`/${locale}/register`} className="text-primary hover:text-primary/80 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              {t('register')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
