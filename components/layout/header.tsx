'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sword, Menu, Globe, LogOut, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/auth-context'
import { useState } from 'react'

interface HeaderProps { locale: string }

export function Header({ locale }: HeaderProps) {
  const t = useTranslations()
  const { user, logout, isAuthenticated } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const otherLocale = locale === 'es' ? 'en' : 'es'
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  const qs = searchParams.toString()
  const switchHref = `/${otherLocale}${pathWithoutLocale}${qs ? `?${qs}` : ''}`

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <a href="#main-content" className="skip-link">
        {t('nav.skipToContent')}
      </a>
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        <Link href={`/${locale}`} className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md" aria-label={t('nav.logoAriaLabel')}>
          <Sword className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-cinzel text-xl font-bold text-gradient-gold">ALEA</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6" aria-label={t('nav.mainNavAriaLabel')}>
          {isAuthenticated && (
            <>
              <Link href={`/${locale}/rooms`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1">
                {t('nav.rooms')}
              </Link>
              <Link href={`/${locale}/reservations`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1">
                {t('nav.reservations')}
              </Link>
              {user?.role === 'admin' && (
                <Link href={`/${locale}/admin`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1">
                  {t('nav.admin')}
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link href={switchHref} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Switch to ${otherLocale}`}>
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="uppercase font-medium">{otherLocale}</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:block text-sm text-muted-foreground">#{user?.memberNumber}</span>
              {user?.role === 'admin' && (
                <Link href={`/${locale}/admin`}>
                  <Button variant="ghost" size="icon" aria-label={t('nav.admin')}>
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="icon" onClick={logout} aria-label={t('nav.logout')}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Link href={`/${locale}/login`}>
              <Button size="sm">{t('auth.login')}</Button>
            </Link>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-expanded={mobileMenuOpen} aria-controls="mobile-menu" aria-label={t('nav.menuAriaLabel')}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {mobileMenuOpen && isAuthenticated && (
        <nav id="mobile-menu" className="md:hidden border-t border-border bg-background/95 px-4 py-3 space-y-2" aria-label={t('nav.mobileNavAriaLabel')}>
          <Link href={`/${locale}/rooms`} className="block py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>{t('nav.rooms')}</Link>
          <Link href={`/${locale}/reservations`} className="block py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>{t('nav.reservations')}</Link>
          {user?.role === 'admin' && (
            <Link href={`/${locale}/admin`} className="block py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>{t('nav.admin')}</Link>
          )}
        </nav>
      )}
    </header>
  )
}
