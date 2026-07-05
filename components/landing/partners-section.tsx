import { getTranslations } from 'next-intl/server'
import type { Partner } from '@/lib/types'
import { MarqueeRow } from './marquee-row'
import { PartnerCard } from './partner-card'

interface PartnersSectionProps {
  locale: string
  partners: Partner[]
}

export async function PartnersSection({ locale, partners }: PartnersSectionProps) {
  // No active partners to show — don't render an orphaned section (kicker +
  // heading with no content below it).
  if (partners.length === 0) return null

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
        {partners.map((partner) => {
          const isMap = !!partner.linkUrl && (partner.linkUrl.includes('maps.app.goo.gl') || partner.linkUrl.includes('google.com/maps'))
          const cta = isMap ? (locale === 'en' ? 'Get directions' : 'Cómo llegar') : locale === 'en' ? 'Visit' : 'Visitar'
          return <PartnerCard key={partner.id} partner={partner} locale={locale} ctaLabel={cta} isMap={isMap} />
        })}
      </MarqueeRow>
    </section>
  )
}
