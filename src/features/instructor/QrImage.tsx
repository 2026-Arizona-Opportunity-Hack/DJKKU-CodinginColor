import { useEffect, useState } from 'react'
import { qrDataUrl } from './qr'

/** A QR code for `text`, drawn locally. `label` says what it opens, for screen readers. */
export function QrImage({ text, label, size = 160 }: { text: string; label: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void qrDataUrl(text, size).then((url) => { if (!cancelled) setSrc(url) })
    return () => { cancelled = true }
  }, [text, size])
  if (!src) return <div style={{ width: size, height: size }} aria-hidden="true" className="bg-muted" />
  return <img src={src} width={size} height={size} alt={label} />
}
