import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Sword } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LandingNavProps {
  locale: string
}

export async function LandingNav({ locale }: LandingNavProps) {
  const t = await getTranslations('home')

  const links = [
    { href: '#about', label: t('nav.about') },
    { href: '#events', label: t('nav.events') },
    { href: '#culture', label: t('nav.culture') },
    { href: '#partners', label: t('nav.partners') },
    { href: '#contact', label: t('nav.contact') },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href={`/${locale}`} className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Sword className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-cinzel text-xl font-bold text-gradient-gold">ALEA</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link href={`/${locale}/login`}>
          <Button size="sm">{t('cta.members')}</Button>
        </Link>
      </div>
    </header>
  )
}
