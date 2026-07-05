import { getTranslations } from 'next-intl/server'
import { Reveal } from './reveal'

const VALUES = [
  { key: 'comunidad', icon: '🎲' },
  { key: 'participacion', icon: '♟' },
  { key: 'diversidad', icon: '🏳️‍🌈' },
] as const

export async function ClubValuesSection() {
  const t = await getTranslations('home')

  return (
    <section className="mod-culture" id="culture">
      <div className="mod-section-head center">
        <span className="mod-kicker">{t('culture.kicker')}</span>
        <h2 className="mod-h2">{t('culture.title')}</h2>
      </div>
      <div className="mod-culture-grid">
        {VALUES.map(({ key, icon }, i) => (
          <Reveal key={key} delay={i * 100} className="mod-value">
            <svg viewBox="0 0 60 60" width="80" height="80" className="mod-value-hex" aria-hidden="true">
              <polygon points="30,2 56,17 56,43 30,58 4,43 4,17" fill="none" stroke="#c8a25b" strokeWidth="1.5" />
              <polygon points="30,8 50,20 50,40 30,52 10,40 10,20" fill="rgba(200,162,91,0.12)" />
              <text x="30" y="40" textAnchor="middle" fontSize="22" fill="#c8a25b">
                {icon}
              </text>
            </svg>
            <h3>{t(`values.${key}.title`)}</h3>
            <p>{t(`values.${key}.body`)}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
