import { getTranslations } from 'next-intl/server'
import { Handshake } from 'lucide-react'

export async function PartnersSection() {
  const t = await getTranslations('home')

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {t('partnersEyebrow')}
        </p>
        <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('partnersTitle')}
        </h2>
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
          {t('partnersSubtitle')}
        </p>
      </header>

      <div className="mt-10 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background-secondary/40 px-6 py-10 text-center">
        <Handshake className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-md text-sm text-muted-foreground">{t('partnersComingSoon')}</p>
      </div>
    </section>
  )
}
