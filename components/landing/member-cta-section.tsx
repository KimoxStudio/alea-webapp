import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MemberCtaSectionProps {
  locale: string
}

export async function MemberCtaSection({ locale }: MemberCtaSectionProps) {
  const t = await getTranslations('home')

  const benefits = [
    t('register.benefit1'),
    t('register.benefit2'),
    t('register.benefit3'),
    t('register.benefit4'),
  ]

  return (
    <section className="border-t border-border bg-background-secondary">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('register.title')}
        </h2>
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
          {t('register.body')}
        </p>

        <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left sm:grid-cols-2">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm leading-6 text-foreground/90">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <Link href={`/${locale}/login`}>
            <Button size="lg">{t('cta.join')}</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
