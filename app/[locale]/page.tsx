import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { ArrowRight, BookOpen, CalendarDays, Layers, Sword, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSessionFromServerCookies } from '@/lib/server/auth'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home')
  return {
    title: `Alea — ${t('heroTitle')}`,
    description: t('heroSubtitle'),
  }
}

interface HomePageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params
  const t = await getTranslations('home')
  const session = await getSessionFromServerCookies()

  if (session) {
    redirect(`/${locale}/rooms`)
  }

  const stats = [
    { label: locale === 'es' ? 'Salas activas' : 'Active rooms', value: '6', icon: Sword },
    { label: locale === 'es' ? 'Mesas disponibles' : 'Available tables', value: '39', icon: Layers },
    { label: locale === 'es' ? 'Reservas al día' : 'Daily booking flow', value: '24/7', icon: CalendarDays },
  ]

  return (
    <div className="relative overflow-hidden bg-background px-6 pb-24 pt-32 md:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,183,123,0.18),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,19,19,0.45),rgba(19,19,19,0.96))]" />
        <div className="absolute inset-y-0 right-[-10rem] flex items-center text-[20rem] text-white/[0.035] md:text-[28rem]">
          ALEA
        </div>
      </div>

      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-2 py-8 text-center">
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_40px_rgba(255,183,123,0.28)] md:h-36 md:w-36">
          <Sword className="h-12 w-12 text-primary md:h-16 md:w-16" aria-hidden="true" />
        </div>

        <span className="mb-4 text-xs uppercase tracking-[0.45em] text-primary/80">
          {locale === 'es' ? 'Board games, rol y cultura' : 'Board games, roleplay and culture'}
        </span>
        <h1 className="max-w-3xl font-cinzel text-4xl italic leading-none tracking-tight text-primary md:text-6xl">
          {t('heroTitle')}
        </h1>
        <div className="my-8 h-px w-24 bg-primary/30" />
        <p className="max-w-2xl text-base leading-8 text-on-surface-variant md:text-lg">
          {t('heroSubtitle')}
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col gap-4 sm:flex-row sm:justify-center">
          <Link href={`/${locale}/login`} className="flex-1">
            <Button size="lg" className="w-full rounded-full font-semibold uppercase tracking-[0.22em]">
              {locale === 'es' ? 'Entrar' : 'Enter'}
            </Button>
          </Link>
          <Link href={`/${locale}/register`} className="flex-1">
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-full border-[1.5px] border-primary bg-transparent font-semibold uppercase tracking-[0.22em] text-primary hover:bg-primary/10"
            >
              {locale === 'es' ? 'Registrarse' : 'Register'}
            </Button>
          </Link>
        </div>
      </section>

      <section className="relative mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-12">
        <article className="relative overflow-hidden bg-surface-container-low px-8 py-10 md:col-span-7 md:px-10">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-primary/80">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>{locale === 'es' ? 'Colección destacada' : 'Featured collection'}</span>
          </div>
          <h2 className="mt-5 font-cinzel text-3xl italic tracking-tight text-secondary">
            {locale === 'es' ? 'La Biblioteca de Alejandría' : 'The Library of Alexandria'}
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-8 text-on-surface-variant md:text-base">
            {locale === 'es'
              ? 'Una colección viva de rol, estrategia y juegos de mesa que reúne mesas para campañas narrativas, sesiones competitivas y encuentros abiertos de la asociación.'
              : 'A living collection of roleplay, strategy, and board games that anchors campaign nights, competitive sessions, and open association gatherings.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <span className="rounded-full bg-background-secondary/70 px-3 py-2">
              {locale === 'es' ? 'Mesas de tapa removible' : 'Removable top tables'}
            </span>
            <span className="rounded-full bg-background-secondary/70 px-3 py-2">
              {locale === 'es' ? 'Reservas en tiempo real' : 'Real-time reservations'}
            </span>
            <span className="rounded-full bg-background-secondary/70 px-3 py-2">
              {locale === 'es' ? 'Comunidad cultural' : 'Cultural community'}
            </span>
          </div>
        </article>

        <aside className="space-y-4 md:col-span-5">
          <div className="bg-surface-container p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-primary/80">
              {locale === 'es' ? 'Estado de la casa' : 'House status'}
            </p>
            <h2 className="mt-4 font-cinzel text-3xl italic text-on-surface">
              {locale === 'es' ? 'Una sede para cada partida' : 'A hall for every session'}
            </h2>
            <p className="mt-4 text-sm leading-8 text-on-surface-variant">
              {locale === 'es'
                ? 'Salas temáticas, mesas pequeñas y grandes, además de superficies dobles para campañas tácticas y juego escénico.'
                : 'Themed rooms, small and large tables, and dual-surface setups for tactical campaigns and scenic play.'}
            </p>
            <Link href={`/${locale}/register`} className="mt-8 inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-primary transition-colors hover:text-primary/80">
              <span>{locale === 'es' ? 'Solicitar acceso' : 'Request access'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-1">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-surface-container-high/60 px-6 py-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
                </div>
                <p className="mt-4 font-cinzel text-4xl italic text-primary">{value}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="relative mx-auto mt-16 max-w-6xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: t('feature1Title'),
              description: t('feature1Desc'),
              icon: CalendarDays,
            },
            {
              title: t('feature2Title'),
              description: t('feature2Desc'),
              icon: Users,
            },
            {
              title: t('feature3Title'),
              description: t('feature3Desc'),
              icon: Layers,
            },
          ].map(({ title, description, icon: Icon }) => (
            <article key={title} className="bg-surface-container-lowest/70 px-6 py-7 backdrop-blur-sm">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-5 font-cinzel text-xl text-on-surface">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
