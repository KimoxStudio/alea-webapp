import { getTranslations } from 'next-intl/server'
import { PARTNERS } from './partners-data'
import { MarqueeRow } from './marquee-row'

interface PartnersSectionProps {
  locale: string
}

export async function PartnersSection({ locale }: PartnersSectionProps) {
  const t = await getTranslations('home')
  const prevLabel = locale === 'en' ? 'Previous partner' : 'Colaborador anterior'
  const nextLabel = locale === 'en' ? 'Next partner' : 'Siguiente colaborador'

  return (
    <section className="mod-partners" id="partners">
      <div className="mod-section-head">
        <div>
          <span className="mod-kicker">{t('partners.kicker')}</span>
          <h2 className="mod-h2">{t('partners.title')}</h2>
        </div>
      </div>

      <MarqueeRow ariaLabel={t('partners.title')} speedPxSec={0} prevLabel={prevLabel} nextLabel={nextLabel}>
        {PARTNERS.map((partner) => {
          const desc = locale === 'en' ? partner.descriptionEn : partner.descriptionEs
          const isMap = partner.linkUrl.includes('maps.app.goo.gl') || partner.linkUrl.includes('google.com/maps')
          const cta = isMap ? (locale === 'en' ? 'Get directions' : 'Cómo llegar') : locale === 'en' ? 'Visit' : 'Visitar'
          return (
            <a
              key={partner.name}
              className="mod-partner-card"
              href={partner.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={partner.name}
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
            >
              <span className="mod-partner-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partner.imageUrl} alt={partner.name} loading="lazy" draggable="false" onDragStart={(e) => e.preventDefault()} />
              </span>
              <span className="mod-partner-body">
                <span className="mod-partner-name">{partner.name}</span>
                {desc && <span className="mod-partner-desc">{desc}</span>}
              </span>
              <span className="mod-partner-cta">
                {isMap ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M12 2 C 7.6 2 4 5.6 4 10 C 4 17 12 22 12 22 C 12 22 20 17 20 10 C 20 5.6 16.4 2 12 2 Z M 12 12.5 A 2.5 2.5 0 1 1 12 7.5 A 2.5 2.5 0 0 1 12 12.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M7 17 L 17 7 M 9 7 L 17 7 L 17 15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {cta}
              </span>
            </a>
          )
        })}
      </MarqueeRow>
    </section>
  )
}
