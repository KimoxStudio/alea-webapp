import { getTranslations } from 'next-intl/server'
import { GAME_LIBRARY_HIGHLIGHTS } from './game-library-data'
import { GameCard } from './game-card'
import { MarqueeRow } from './marquee-row'

interface GameLibrarySectionProps {
  locale: string
}

export async function GameLibrarySection({ locale }: GameLibrarySectionProps) {
  const t = await getTranslations('home')
  const prevLabel = locale === 'en' ? 'Previous game' : 'Juego anterior'
  const nextLabel = locale === 'en' ? 'Next game' : 'Siguiente juego'

  return (
    <section className="mod-games" id="games">
      <div className="mod-section-head">
        <div>
          <span className="mod-kicker">{t('games.kicker')}</span>
          <h2 className="mod-h2">{t('games.title')}</h2>
          <p className="mod-lead">{t('games.subtitle')}</p>
        </div>
      </div>

      <MarqueeRow ariaLabel={t('games.title')} speedPxSec={20} prevLabel={prevLabel} nextLabel={nextLabel}>
        {GAME_LIBRARY_HIGHLIGHTS.map((game, i) => (
          <GameCard
            key={game.title}
            game={game}
            locale={locale}
            idx={i}
            playersLabel={t('games.players')}
            timeLabel={t('games.time')}
            weightLabel={t('games.weight')}
          />
        ))}
      </MarqueeRow>
    </section>
  )
}
