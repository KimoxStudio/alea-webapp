'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * OIR-206: shared disclosure that groups the (now optional) English inputs
 * in the club-events / partners / library-games admin forms. Collapsed by
 * default — the board only needs to open it when they want to override the
 * automatic Spanish→English fallback the service applies (see
 * resolveBilingualEnFallback in the corresponding *-service.ts files).
 *
 * Implemented as a plain disclosure (no new dependency) rather than the
 * shadcn/radix Collapsible primitive, which isn't installed in this repo.
 */
export function OptionalEnglishFields({ children, idPrefix }: { children: ReactNode; idPrefix: string }) {
  const t = useTranslations('admin')
  const [open, setOpen] = useState(false)
  const contentId = `${idPrefix}-english-optional-content`

  return (
    <div className="rounded-lg border border-border bg-background-secondary/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-background-secondary/50"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">{t('englishOptional.title')}</span>
          <span className="block text-xs text-muted-foreground">{t('englishOptional.hint')}</span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      <div id={contentId} hidden={!open} className="space-y-3 border-t border-border p-3">
        {children}
      </div>
    </div>
  )
}
