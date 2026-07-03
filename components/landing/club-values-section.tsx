import { getTranslations } from 'next-intl/server'
import { Users, Coins, Heart, GraduationCap } from 'lucide-react'

export async function ClubValuesSection() {
  const t = await getTranslations('home')

  const values = [
    { icon: Users, titleKey: 'valueCommunityTitle', descKey: 'valueCommunityDesc' },
    { icon: Coins, titleKey: 'valueAccessibilityTitle', descKey: 'valueAccessibilityDesc' },
    { icon: Heart, titleKey: 'valuePassionTitle', descKey: 'valuePassionDesc' },
    { icon: GraduationCap, titleKey: 'valueLearningTitle', descKey: 'valueLearningDesc' },
  ] as const

  return (
    <section className="border-t border-border bg-background-secondary">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {t('valuesEyebrow')}
          </p>
          <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('valuesTitle')}
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
            {t('valuesSubtitle')}
          </p>
        </header>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-cinzel text-lg font-semibold text-foreground">{t(titleKey)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
