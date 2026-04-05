import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import {
  Sword, Shield, Map, QrCode, CalendarDays, Users,
  Layers, BookOpen, ChevronRight, Dices, ExternalLink,
  ScrollText
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

  // PLACEHOLDER — user will set their real association URL
  const associationUrl = 'https://alea.example.com'

  const features = [
    {
      icon: CalendarDays,
      title: t('feature1Title'),
      desc: t('feature1Desc'),
      color: 'text-gold-400',
      bg: 'bg-gold-900/20 border-gold-500/20',
    },
    {
      icon: QrCode,
      title: t('feature2Title'),
      desc: t('feature2Desc'),
      color: 'text-emerald-light',
      bg: 'bg-emerald-dark/20 border-emerald/20',
    },
    {
      icon: BookOpen,
      title: t('feature3Title'),
      desc: t('feature3Desc'),
      color: 'text-arcane-light',
      bg: 'bg-arcane-dark/20 border-arcane/20',
    },
    {
      icon: Layers,
      title: t('feature4Title'),
      desc: t('feature4Desc'),
      color: 'text-crimson-light',
      bg: 'bg-crimson-dark/20 border-crimson/20',
    },
  ]

  return (
    <div className="flex flex-col">

      {/* HERO SECTION */}
      <section
        className="relative overflow-hidden px-4 py-24 md:py-36 flex flex-col items-center justify-center text-center"
        aria-labelledby="hero-heading"
      >
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-arcane/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-emerald/5 blur-3xl" />

          {/* RPG grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
            <Dices className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'es' ? 'Asociacion Cultural de Juegos' : 'Cultural Gaming Association'}</span>
          </div>

          {/* Main heading */}
          <h1
            id="hero-heading"
            className="font-cinzel text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          >
            <span className="text-gradient-gold">{t('heroTitle')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('heroSubtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4" role="group" aria-label={locale === 'es' ? 'Acciones principales' : 'Main actions'}>
            <Link href={`/${locale}/register`}>
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8 h-12">
                <Shield className="h-5 w-5" aria-hidden="true" />
                {t('heroCtaRegister')}
              </Button>
            </Link>

            <a
              href={associationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-12 px-8 text-base font-medium text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('heroCtaLearnMore')}
            </a>
          </div>

          {/* Already a member */}
          <p className="mt-6 text-sm text-muted-foreground">
            {t('ctaLoginText')}{' '}
            <Link
              href={`/${locale}/login`}
              className="text-primary hover:text-primary/80 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded underline-offset-4 hover:underline"
            >
              {t('ctaLoginLink')} →
            </Link>
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground animate-bounce" aria-hidden="true">
          <div className="w-5 h-8 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-border bg-background-secondary/50 py-8 px-4" aria-label={locale === 'es' ? 'Cifras de la asociacion' : 'Association stats'}>
        <div className="container mx-auto max-w-5xl">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '6', label: locale === 'es' ? 'Salas de juego' : 'Game rooms', icon: Map },
              { value: '39', label: locale === 'es' ? 'Mesas disponibles' : 'Available tables', icon: Sword },
              { value: '3', label: locale === 'es' ? 'Tipos de mesa' : 'Table types', icon: Layers },
              { value: '24/7', label: locale === 'es' ? 'Reservas online' : 'Online booking', icon: CalendarDays },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <dt className="font-cinzel text-3xl font-bold text-gradient-gold">{value}</dt>
                </div>
                <dd className="text-sm text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section
        className="px-4 py-20 md:py-28"
        aria-labelledby="features-heading"
      >
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2
              id="features-heading"
              className="font-cinzel text-3xl md:text-4xl font-bold text-gradient-gold mb-4"
            >
              {t('featuresTitle')}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('featuresSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`rpg-card p-6 flex flex-col gap-4 border ${feature.bg}`}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${feature.bg} border`}>
                  <feature.icon className={`h-5 w-5 ${feature.color}`} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-cinzel font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section
        className="px-4 py-20 bg-background-secondary/30 border-y border-border"
        aria-labelledby="how-heading"
      >
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2
              id="how-heading"
              className="font-cinzel text-3xl md:text-4xl font-bold text-gradient-gold mb-4"
            >
              {locale === 'es' ? 'Como funciona?' : 'How does it work?'}
            </h2>
            <p className="text-muted-foreground text-lg">
              {locale === 'es' ? 'En tres pasos, ya estas jugando.' : 'In three steps, you are already playing.'}
            </p>
          </div>

          <ol className="relative" aria-label={locale === 'es' ? 'Pasos para empezar' : 'Steps to get started'}>
            {/* Connecting line */}
            <div className="absolute left-5 md:left-1/2 top-8 bottom-8 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden sm:block" aria-hidden="true" />

            {[
              {
                step: '01',
                icon: ScrollText,
                title: locale === 'es' ? 'Hazte socio' : 'Become a member',
                desc: locale === 'es'
                  ? 'Registrate con tu numero de socio. Tu contraseña debe tener al menos 12 caracteres y un simbolo especial.'
                  : 'Register with your member number. Your password must be at least 12 characters with a special symbol.',
              },
              {
                step: '02',
                icon: Map,
                title: locale === 'es' ? 'Elige tu sala y mesa' : 'Choose your room and table',
                desc: locale === 'es'
                  ? 'Navega entre las 6 salas, consulta que mesas estan disponibles en tiempo real y elige la que mas se adapte a tu partida.'
                  : 'Browse the 6 rooms, check which tables are available in real time and choose the one that fits your game.',
              },
              {
                step: '03',
                icon: QrCode,
                title: locale === 'es' ? 'Confirma y juega' : 'Confirm and play',
                desc: locale === 'es'
                  ? 'Confirma la reserva, escanea el QR de la mesa cuando llegues y empieza tu aventura. Asi de facil!'
                  : 'Confirm the reservation, scan the table QR when you arrive and start your adventure. That easy!',
              },
            ].map(({ step, icon: Icon, title, desc }, index) => (
              <li
                key={step}
                className={`relative flex gap-6 mb-10 last:mb-0 ${
                  index % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* Step number + icon */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center z-10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <span className="font-cinzel text-xs text-primary/60 mt-1">{step}</span>
                </div>

                {/* Content */}
                <div className="rpg-card p-6 flex-1 max-w-md">
                  <h3 className="font-cinzel font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA SECTION */}
      <section
        className="px-4 py-24 text-center relative overflow-hidden"
        aria-labelledby="cta-heading"
      >
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6" aria-hidden="true">
            <Sword className="h-8 w-8 text-primary" />
            <Shield className="h-8 w-8 text-primary" />
          </div>

          <h2
            id="cta-heading"
            className="font-cinzel text-3xl md:text-4xl font-bold text-gradient-gold mb-4"
          >
            {t('ctaTitle')}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {t('ctaSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${locale}/register`}>
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-10 h-12">
                <Users className="h-5 w-5" aria-hidden="true" />
                {t('ctaButton')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href={`/${locale}/login`}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 h-12">
                {t('ctaLoginLink')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
