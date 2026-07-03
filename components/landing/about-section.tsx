import { getTranslations } from 'next-intl/server'
import { Check } from 'lucide-react'

export async function AboutSection() {
  const t = await getTranslations('home')

  const bullets = [t('about.bullet1'), t('about.bullet2'), t('about.bullet3'), t('about.bullet4')]

  return (
    <section className="border-t border-border bg-background-secondary">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {t('about.kicker')}
        </p>
        <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('about.title')}
        </h2>
        <p className="mt-6 text-pretty text-base leading-7 text-muted-foreground">{t('about.body')}</p>
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">{t('about.body2')}</p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm leading-6 text-foreground/90">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
