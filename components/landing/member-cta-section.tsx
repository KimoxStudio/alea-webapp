import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

interface MemberCtaSectionProps {
  locale: string
}

export async function MemberCtaSection({ locale }: MemberCtaSectionProps) {
  const t = await getTranslations('home')

  return (
    <section className="border-t border-border bg-background-secondary">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-balance font-cinzel text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('ctaTitle')}
        </h2>
        <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
          {t('ctaSubtitle')}
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link href={`/${locale}/login`}>
            <Button size="lg">{t('ctaButton')}</Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            {t('ctaLoginText')}{' '}
            <Link href={`/${locale}/login`} className="font-medium text-primary hover:underline">
              {t('ctaLoginLink')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
