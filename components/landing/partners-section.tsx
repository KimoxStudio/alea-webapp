import { getTranslations } from 'next-intl/server'
import { PARTNERS } from './partners-data'
import { MarqueeRow } from './marquee-row'
import { PartnerCard } from './partner-card'

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
          const isMap = partner.linkUrl.includes('maps.app.goo.gl') || partner.linkUrl.includes('google.com/maps')
          const cta = isMap ? (locale === 'en' ? 'Get directions' : 'Cómo llegar') : locale === 'en' ? 'Visit' : 'Visitar'
          return <PartnerCard key={partner.name} partner={partner} locale={locale} ctaLabel={cta} isMap={isMap} />
        })}
      </MarqueeRow>
    </section>
  )
}
