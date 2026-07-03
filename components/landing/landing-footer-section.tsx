import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MapPin, Mail, Instagram, Facebook } from 'lucide-react'

interface LandingFooterSectionProps {
  locale: string
}

export async function LandingFooterSection({ locale }: LandingFooterSectionProps) {
  const t = await getTranslations('home')

  const address = t('business.address')
  const email = t('business.email')
  const instagram = t('business.instagram')
  const facebook = t('business.facebook')
  const mapsUrl = t('business.mapsUrl')

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="font-cinzel text-sm font-semibold uppercase tracking-wider text-foreground">
              {t('footer.find')}
            </h3>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{address}</span>
            </a>
          </div>

          <div>
            <h3 className="font-cinzel text-sm font-semibold uppercase tracking-wider text-foreground">
              {t('footer.write')}
            </h3>
            <a
              href={`mailto:${email}`}
              className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{email}</span>
            </a>
          </div>

          <div>
            <h3 className="font-cinzel text-sm font-semibold uppercase tracking-wider text-foreground">
              {t('footer.follow')}
            </h3>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-muted-foreground hover:text-primary"
              >
                <Instagram className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href={facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-muted-foreground hover:text-primary"
              >
                <Facebook className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 border-t border-border pt-6 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">{t('footer.rights')}</p>
          <Link
            href={`/${locale}/login`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t('footer.admin')}
          </Link>
        </div>
      </div>
    </section>
  )
}
