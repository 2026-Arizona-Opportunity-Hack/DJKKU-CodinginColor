import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QrImage } from './QrImage'
import { createJoinCode } from './setupApi'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** A class link for late joiners. The code is shown once and kept only in memory. */
export function JoinCodeCard({ classId }: { classId: string }) {
  const id = useId()
  const [copied, setCopied] = useState('')
  const make = useMutation({ mutationFn: () => createJoinCode(classId) })
  const code = make.data?.join_code
  const link = code ? `${window.location.origin}/join/${code}` : ''

  async function onCopy(what: string, text: string) {
    setCopied((await copy(text)) ? `${what} copied.` : "Couldn't copy. Select the text and copy it yourself.")
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="text-xl font-semibold">Class link</h2>
      <p className="text-sm text-muted-foreground">
        For students who joined late and have no login card. They open the link and pick their own name.
        Anyone with the link can claim a name that has not been taken, so share it only in class.
        Making a new link stops the old one from working.
      </p>
      <Button className="self-start" disabled={make.isPending} onClick={() => { setCopied(''); make.mutate() }}>
        {make.isPending ? 'Making…' : 'Make a class link'}
      </Button>
      <div role="alert" className="text-sm font-medium text-destructive empty:hidden">{make.error?.message}</div>
      {code && (
        <div className="flex flex-wrap items-start gap-6 rounded-lg border p-4">
          <div className="flex min-w-64 flex-1 flex-col gap-2">
            <p className="text-sm font-medium">This is the only time you will see this link. Copy it or show the QR code now.</p>
            <Label htmlFor={`${id}-link`}>Link to share</Label>
            <Input id={`${id}-link`} readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <p>Class code: <span className="font-mono text-lg font-semibold">{code}</span></p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void onCopy('Link', link)}>Copy link</Button>
              <Button variant="outline" onClick={() => void onCopy('Code', code)}>Copy code</Button>
            </div>
            <p role="status" className="text-sm">{copied}</p>
          </div>
          <QrImage text={link} label="QR code for the class link" />
        </div>
      )}
    </section>
  )
}
