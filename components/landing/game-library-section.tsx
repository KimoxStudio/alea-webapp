import { getTranslations } from 'next-intl/server'
import { Dices, BookOpen, Swords } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export async function GameLibrarySection() {
  const t = await getTranslations('home')

  const categories = [
    { icon: Dices, titleKey: 'gameLibraryBoardGamesTitle', descKey: 'gameLibraryBoardGamesDesc' },
    { icon: BookOpen, titleKey: 'gameLibraryRoleplayingTitle', descKey: 'gameLibraryRoleplayingDesc' },
    { icon: Swords, titleKey: 'gameLibraryWargamesTitle', descKey: 'gameLibraryWargamesDesc' },
  ] as const

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {t('gameLibraryEyebrow')}
        </p>
        <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('gameLibraryTitle')}
        </h2>
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
          {t('gameLibrarySubtitle')}
        </p>
      </header>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {categories.map(({ icon: Icon, titleKey, descKey }) => (
          <Card key={titleKey}>
            <CardHeader>
              <Icon className="mb-3 h-8 w-8 text-primary" aria-hidden="true" />
              <CardTitle>{t(titleKey)}</CardTitle>
              <CardDescription>{t(descKey)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}
