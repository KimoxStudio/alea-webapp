'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, Globe, LayoutDashboard, LogOut, Menu, Sword, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

interface HeaderProps {
  locale: string
}

export function Header({ locale }: HeaderProps) {
  const t = useTranslations()
  const pathname = usePathname()
  const { user, logout, isAuthenticated } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const otherLocale = locale === 'es' ? 'en' : 'es'

  const navItems = [
    { href: `/${locale}/rooms`, label: t('nav.rooms'), visible: isAuthenticated },
    { href: `/${locale}/reservations`, label: t('nav.reservations'), visible: isAuthenticated },
    { href: `/${locale}/admin`, label: t('nav.admin'), visible: user?.role === 'admin' },
  ].filter((item) => item.visible)

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-stone-950/80 backdrop-blur-xl shadow-2xl shadow-black/40">
      <a href="#main-content" className="skip-link">
        {locale === 'es' ? 'Ir al contenido principal' : 'Skip to main content'}
      </a>

      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-4 md:px-12">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Alea"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-[0_0_30px_rgba(255,183,123,0.15)]">
            <Sword className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="font-cinzel text-2xl italic tracking-tight text-primary">ALEA</span>
            <span className="hidden text-[10px] uppercase tracking-[0.35em] text-muted-foreground md:block">
              Tabletop Association
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-10 md:flex" aria-label={locale === 'es' ? 'Navegacion principal' : 'Main navigation'}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'border-b pb-1 font-cinzel text-sm uppercase tracking-[0.22em] transition-colors',
                isActive(item.href)
                  ? 'border-primary/50 text-primary'
                  : 'border-transparent text-foreground/70 hover:text-primary'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href={`/${otherLocale}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs uppercase tracking-[0.25em] text-foreground/70 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={locale === 'es' ? `Cambiar a ${otherLocale}` : `Switch to ${otherLocale}`}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{otherLocale}</span>
          </Link>

          {isAuthenticated ? (
            <>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 md:flex">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {user?.role === 'admin' ? t('nav.admin') : t('nav.profile')}
                </span>
                <span className="font-cinzel text-sm text-primary">#{user?.memberNumber}</span>
              </div>
              <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-primary" aria-label="Notifications">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </Button>
              {user?.role === 'admin' && (
                <Link href={`/${locale}/admin`}>
                  <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-primary" aria-label={t('nav.admin')}>
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-primary" onClick={logout} aria-label={t('nav.logout')}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <div className="hidden items-center gap-3 md:flex">
              <Link href={`/${locale}/login`}>
                <Button variant="ghost" className="font-cinzel uppercase tracking-[0.2em] text-foreground/80 hover:text-primary">
                  {t('auth.login')}
                </Button>
              </Link>
              <Link href={`/${locale}/register`}>
                <Button className="rounded-full px-5 font-semibold uppercase tracking-[0.22em]">
                  {t('auth.register')}
                </Button>
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="text-foreground/70 hover:text-primary md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={locale === 'es' ? 'Abrir menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-menu" className="border-t border-white/5 bg-stone-950/95 px-6 py-4 md:hidden">
          <div className="space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-lg px-4 py-3 font-cinzel text-sm uppercase tracking-[0.2em] transition-colors',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary'
                    : 'bg-white/5 text-foreground/80 hover:text-primary'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {!isAuthenticated && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link href={`/${locale}/login`} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">
                    {t('auth.login')}
                  </Button>
                </Link>
                <Link href={`/${locale}/register`} onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">
                    {t('auth.register')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
