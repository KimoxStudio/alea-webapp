import { getTranslations } from 'next-intl/server'
import { Dices } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { GAME_LIBRARY_HIGHLIGHTS } from './game-library-data'

interface GameLibrarySectionProps {
  locale: string
}

export async function GameLibrarySection({ locale }: GameLibrarySectionProps) {
  const t = await getTranslations('home')

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {t('games.kicker')}
        </p>
        <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('games.title')}
        </h2>
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
          {t('games.subtitle')}
        </p>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GAME_LIBRARY_HIGHLIGHTS.map((game) => (
          <Card key={game.title} className="group">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Dices className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-base">{game.title}</CardTitle>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                {locale === 'en' ? game.categoryEn : game.categoryEs}
              </p>
              <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <dt>{t('games.players')}</dt>
                  <dd>{game.players}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('games.time')}</dt>
                  <dd>{game.time}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('games.weight')}</dt>
                  <dd>{game.weight.toFixed(1)}</dd>
                </div>
              </dl>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}
