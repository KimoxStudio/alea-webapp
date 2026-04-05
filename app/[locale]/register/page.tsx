import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ArrowRight, ScrollText, Sparkles } from 'lucide-react'
import { RegisterForm } from '@/components/auth/register-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: `${t('register')} -- Alea` }
}

interface RegisterPageProps {
  params: Promise<{ locale: string }>
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params
  const t = await getTranslations('auth')

  return (
    <div className="relative overflow-hidden px-6 py-12 md:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,183,123,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(200,128,63,0.12),_transparent_34%)]" />
        <div className="heraldic-watermark flex items-center justify-center text-[24rem] font-cinzel italic text-on-surface">A</div>
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-0 lg:grid-cols-2 lg:gap-12">
        <section className="hidden min-h-[720px] flex-col justify-between overflow-hidden bg-surface-container-lowest p-12 lg:flex">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.35em]">
                {locale === 'es' ? 'Nuevo ingreso' : 'New admission'}
              </span>
            </div>
            <div>
              <p className="font-headline italic text-6xl tracking-widest uppercase text-primary mb-4">ALEA</p>
              <h1 className="mt-6 max-w-md font-headline text-4xl leading-tight text-foreground">
                {t('registerHeadline')}
              </h1>
            </div>
          </div>

          <div className="relative overflow-hidden bg-background-secondary/70 p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,183,123,0.18),_transparent_35%)]" />
            <div className="relative space-y-6">
              <div className="flex items-center gap-3 text-primary">
                <ScrollText className="h-5 w-5" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.3em]">
                  {locale === 'es' ? 'Reglamento de acceso' : 'Admission protocol'}
                </p>
              </div>
              <p className="max-w-sm text-lg leading-relaxed text-on-surface-variant">
                {t('registerBody')}
              </p>
              <div className="border border-primary/20 bg-primary/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.32em] text-primary/75">
                  {locale === 'es' ? 'Requisito base' : 'Core requirement'}
                </p>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  {t('passwordRequirements')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-[640px] items-center justify-center">
          <div className="relative flex flex-col items-center w-full max-w-md p-6 sm:p-10">
            <div className="mb-10 flex w-full border-b border-outline-variant">
              <Link
                href={`/${locale}/login`}
                className="flex-1 px-2 py-4 text-center text-sm font-semibold uppercase tracking-[0.28em] text-outline transition-colors hover:text-on-surface-variant"
              >
                {t('login')}
              </Link>
              <Link
                href={`/${locale}/register`}
                className="flex-1 border-b-2 border-primary px-2 py-4 text-center text-sm font-semibold uppercase tracking-[0.28em] text-primary"
              >
                {t('register')}
              </Link>
            </div>

            <div className="mb-10 w-full text-center lg:text-left">
              <h1 className="font-headline text-3xl text-on-surface mb-2">
                {t('register')}
              </h1>
              <p className="text-on-surface-variant font-body text-sm">
                {t('registerSubtitle')}
              </p>
            </div>

            <RegisterForm locale={locale} />

            <div className="mt-8 text-center text-sm text-on-surface-variant">
              <span>{t('hasAccount')}</span>{' '}
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center gap-1 font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {t('login')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
