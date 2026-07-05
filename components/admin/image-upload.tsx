'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DiceLoader } from '@/components/ui/dice-loader'
import { useAdminUploadImage, type UploadFolder } from '@/lib/hooks/use-admin'

const ACCEPTED_MIME_TYPES = 'image/png,image/jpeg,image/webp,image/gif'

interface ImageUploadProps {
  /** Current image URL (from the manual URL input or a previous upload), used for the preview. */
  value: string
  /** Called with the newly uploaded file's public URL. */
  onChange: (url: string) => void
  folder: UploadFolder
  idPrefix: string
}

/**
 * Shared "upload from device" control (OIR-207) shown above the manual image
 * URL input in the club-events / partners / library-games admin forms. The
 * URL input stays visible and editable as a fallback — this component only
 * ever writes a new value into it via `onChange` on a successful upload.
 */
export function ImageUpload({ value, onChange, folder, idPrefix }: ImageUploadProps) {
  const t = useTranslations('admin')
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useAdminUploadImage()
  const inputId = `${idPrefix}-image-upload`

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    try {
      const { url } = await upload.mutateAsync({ file, folder })
      onChange(url)
    } catch {
      setError(t('imageUpload.error'))
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-sm text-muted-foreground font-medium">
        {t('imageUpload.label')}
      </Label>
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-12 w-12 flex-shrink-0 rounded-md border border-border object-cover"
          />
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_MIME_TYPES}
          onChange={handleFileChange}
          disabled={upload.isPending}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
          className="gap-1.5 border-border"
        >
          {upload.isPending ? (
            <span className="inline-flex items-center gap-2">
              <DiceLoader size="sm" hideRole />
              <span>{t('imageUpload.uploading')}</span>
            </span>
          ) : (
            <>
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              {t('imageUpload.uploadButton')}
            </>
          )}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('imageUpload.hint')}</p>
      )}
    </div>
  )
}
