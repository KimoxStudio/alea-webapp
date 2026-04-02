'use client'

import * as React from 'react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/input'

export interface PasswordInputProps extends InputProps {
  variant?: 'password' | 'confirmation'
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ variant = 'password', type: _ignored, className, ...rest }, ref) => {
    const t = useTranslations('auth')
    const [showPassword, setShowPassword] = useState(false)

    const ariaLabel = showPassword
      ? variant === 'confirmation'
        ? t('hideConfirmation')
        : t('hidePassword')
      : variant === 'confirmation'
        ? t('showConfirmation')
        : t('showPassword')

    return (
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          className={`pr-10 ${className ?? ''}`}
          ref={ref}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label={ariaLabel}
        >
          {showPassword
            ? <EyeOff className="h-4 w-4" aria-hidden="true" />
            : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
