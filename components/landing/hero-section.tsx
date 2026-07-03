import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  locale: string
}

export async function HeroSection({ locale }: HeroSectionProps) {
  const t = await getTranslations('home')

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

        <h1 className="text-balance font-cinzel text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          {t('heroTitle')}
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          {t('heroSubtitle')}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href={`/${locale}/login`}>
            <Button size="lg">{t('heroCtaRegister')}</Button>
          </Link>
          <Link href={`/${locale}/login`}>
            <Button size="lg" variant="outline">{t('heroCtaLogin')}</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
