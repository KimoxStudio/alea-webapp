import { getTranslations } from 'next-intl/server'

const VALUES = [
  { key: 'comunidad', icon: '🎲' },
  { key: 'participacion', icon: '♟' },
  { key: 'diversidad', icon: '🏳️‍🌈' },
] as const

export async function ClubValuesSection() {
  const t = await getTranslations('home')

  return (
    <section className="border-t border-border bg-background-secondary">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {t('culture.kicker')}
          </p>
          <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('culture.title')}
          </h2>
        </header>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {VALUES.map(({ key, icon }) => (
            <div key={key} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl" aria-hidden="true">
                {icon}
              </div>
              <h3 className="font-cinzel text-lg font-semibold text-foreground">{t(`values.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(`values.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
