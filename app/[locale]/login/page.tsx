import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'
import { getSessionFromServerCookies } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: `${t('login')} — Alea` }
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
      // ignore stale/invalid session, render login form
    }
    if (authenticated) {
      redirect(`/${locale}/rooms`)
    }
  }
  const t = await getTranslations('auth')

  return (
    <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT ZONE — atmosphere and brand */}
      <div className="relative hidden lg:flex lg:w-[45%] xl:w-[50%] flex-col justify-between p-14 overflow-hidden">
        {/* Subtle radial ember behind identity block */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 30% 60%, rgba(255, 183, 123, 0.03) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        {/* Top-left corner ornament */}
        <div
          aria-hidden="true"
          className="relative z-10 w-10 h-10 border-l border-t"
          style={{ borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)' }}
        />

        {/* Identity block */}
        <div className="relative z-10 py-8">
          <p
            className="text-[10px] tracking-[0.35em] uppercase font-medium mb-6"
            style={{ color: 'color-mix(in srgb, var(--primary) 55%, transparent)' }}
          >
            Asociación Cultural
          </p>

          {/* Alea logo */}
          <div className="mb-8">
            <Image
              src="/alea-logo.png"
              alt="Alea"
              width={220}
              height={220}
              className="w-[clamp(140px,18vw,220px)] h-auto"
              priority
            />
          </div>

          <div
            className="w-14 h-px mb-8"
            style={{ background: 'color-mix(in srgb, var(--primary) 40%, transparent)' }}
          />

          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            {t('loginSubtitle')}
          </p>
        </div>

        {/* Bottom-left corner ornament */}
        <div
          aria-hidden="true"
          className="relative z-10 w-10 h-10 border-l border-b self-start"
          style={{ borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)' }}
        />
      </div>

      {/* VERTICAL DIVIDER */}
      <div
        className="hidden lg:block w-px self-stretch"
        style={{ background: 'color-mix(in srgb, var(--border) 55%, transparent)' }}
        aria-hidden="true"
      />

      {/* RIGHT ZONE — sign-in panel */}
      <div
        className="flex-1 flex items-center justify-center p-8 lg:p-14 relative overflow-y-auto"
        style={{
          background:
            'color-mix(in srgb, var(--background-secondary) 55%, var(--background))',
        }}
      >
        {/* Subtle ember glow centre */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(255, 183, 123, 0.022) 0%, transparent 65%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-[22rem]">
          {/* Mobile brand header — hidden on lg+ */}
          <div className="lg:hidden text-center mb-10">
            <h1
              className="font-cinzel font-bold tracking-tight mb-2"
              style={{ fontSize: '2.25rem', color: '#e5e2e1' }}
            >
              Alea
            </h1>
            <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
            <div
              className="w-10 h-px mx-auto mt-5"
              style={{ background: 'color-mix(in srgb, var(--primary) 40%, transparent)' }}
            />
          </div>

          {/* Desktop form label */}
          <div className="hidden lg:block mb-8">
            <p
              className="text-[10px] tracking-[0.35em] uppercase font-medium"
              style={{ color: 'color-mix(in srgb, var(--primary) 55%, transparent)' }}
            >
              {t('login')}
            </p>
          </div>

          <LoginForm locale={locale} />

          <p className="mt-7 text-center text-xs text-muted-foreground/60">
            {t('loginHelp')}
          </p>
        </div>
      </div>
    </div>
  )
}
