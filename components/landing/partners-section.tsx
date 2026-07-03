import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { PARTNERS } from './partners-data'

interface PartnersSectionProps {
  locale: string
}

export async function PartnersSection({ locale }: PartnersSectionProps) {
  const t = await getTranslations('home')

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {t('partners.kicker')}
        </p>
        <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('partners.title')}
        </h2>
      </header>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {PARTNERS.map((partner) => {
          const description = locale === 'en' ? partner.descriptionEn : partner.descriptionEs
          return (
            <a
              key={partner.name}
              href={partner.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`${partner.name} — ${description}`}
              className="flex h-24 items-center justify-center rounded-lg border border-border bg-background-secondary/40 p-4 grayscale transition-all hover:grayscale-0 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="relative block h-full w-full">
                <Image
                  src={partner.imageUrl}
                  alt={partner.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 33vw, 20vw"
                />
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
