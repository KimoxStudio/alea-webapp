import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  locale: string
}

export async function HeroSection({ locale }: HeroSectionProps) {
  const t = await getTranslations('home')

  const stats = [
    { number: t('stats.membersNumber'), label: t('stats.membersLabel') },
    { number: t('stats.eventsNumber'), label: t('stats.eventsLabel') },
    { number: t('stats.gamesNumber'), label: t('stats.gamesLabel') },
    { number: t('stats.partnersNumber'), label: t('stats.partnersLabel') },
  ]

  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
      />

      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
        <div className="mb-6 flex items-center gap-2">
          <Sword className="h-8 w-8 text-primary" aria-hidden="true" />
          <span className="font-cinzel text-2xl font-bold text-gradient-gold">ALEA</span>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {t('hero.tagline')} · {t('hero.location')}
        </p>

        <h1 className="mt-4 text-balance font-cinzel text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          {t('hero.titleA')} <span className="text-gradient-gold">{t('hero.titleB')}</span> {t('hero.titleC')}
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          {t('hero.subtitle')}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            {t('hero.badgeOpen')}
          </span>
          <span className="rounded-full border border-border bg-background-secondary px-4 py-1.5 text-sm font-medium text-muted-foreground">
            {t('hero.badgeFee')}
          </span>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href={`/${locale}/login`}>
            <Button size="lg">{t('cta.join')}</Button>
          </Link>
          <Link href={`/${locale}/login`}>
            <Button size="lg" variant="outline">{t('cta.members')}</Button>
          </Link>
        </div>

        <dl className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-cinzel text-2xl font-bold text-foreground sm:text-3xl">{stat.number}</dd>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
