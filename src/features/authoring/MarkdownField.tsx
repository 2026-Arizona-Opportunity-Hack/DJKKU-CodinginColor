import { useId, useState } from 'react'
import { Reading } from '@/components/learning/ActivityContent'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { UseFormRegisterReturn } from 'react-hook-form'

/** A markdown box with a Write and a Preview tab. The preview is the player's own Reading (no raw HTML, safe links). */
export function MarkdownField({
  label,
  registration,
  value,
  error,
  disabled,
}: {
  label: string
  registration: UseFormRegisterReturn
  value: string
  error?: string
  disabled?: boolean
}) {
  const id = useId()
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-text`}>{label}</Label>
        <div role="group" aria-label={`${label} view`} className="flex gap-1">
          <Button type="button" size="sm" variant={tab === 'write' ? 'default' : 'outline'} aria-pressed={tab === 'write'} onClick={() => setTab('write')}>Write</Button>
          <Button type="button" size="sm" variant={tab === 'preview' ? 'default' : 'outline'} aria-pressed={tab === 'preview'} onClick={() => setTab('preview')}>Preview</Button>
        </div>
      </div>
      {/* Both stay mounted so switching tabs never loses what was typed. */}
      <Textarea id={`${id}-text`} rows={8} hidden={tab !== 'write'} disabled={disabled} aria-invalid={Boolean(error)} {...registration} />
      {tab === 'preview' && (
        <div aria-label={`${label} preview`} role="region" className="min-h-24 rounded-md border p-3">
          {value.trim() ? <Reading markdown={value} /> : <p className="text-muted-foreground">Nothing to preview yet.</p>}
        </div>
      )}
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{error}</p>
    </div>
  )
}
