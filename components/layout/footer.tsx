'use client'

import { useTranslations } from 'next-intl'

interface FooterProps {
  locale: string
}

export function Footer({ locale }: FooterProps) {
  const t = useTranslations('footer')

  const links = locale === 'es'
    ? ['Privacidad', 'Términos', 'Contacto']
    : ['Privacy', 'Terms', 'Contact']

  return (
    <footer className="mt-auto flex w-full flex-col items-center justify-between gap-6 border-t border-white/5 bg-[#0e0e0e] px-6 py-10 text-center opacity-70 md:flex-row md:px-12 md:text-left">
      <div className="order-2 flex flex-wrap items-center justify-center gap-8 text-xs uppercase tracking-[0.25em] text-muted-foreground md:order-1 md:justify-start">
        {links.map((link) => (
          <button key={link} type="button" className="transition-colors hover:text-primary">
            {link}
          </button>
        ))}
      </div>
      <p className="order-1 text-sm text-muted-foreground md:order-2">
        &copy; {new Date().getFullYear()} ALEA Tabletop Association. {t('rights')}
      </p>
    </footer>
  )
}
