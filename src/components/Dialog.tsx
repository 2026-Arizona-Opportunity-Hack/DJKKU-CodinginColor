import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * A modal dialog on the native <dialog> element: it traps focus, closes on Escape and returns focus
 * to the button that opened it. `onClose` runs for Escape too, so the parent's state stays in step.
 */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      if (el.showModal) el.showModal()
      else el.setAttribute('open', '')
    }
    if (!open && el.open) {
      if (el.close) el.close()
      else el.removeAttribute('open')
    }
  }, [open])
  if (!open) return null
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={(e) => { e.preventDefault(); onClose() }} className="m-auto max-w-lg rounded-lg border p-6 shadow-lg backdrop:bg-black/40">
      <h2 id={id} className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </dialog>
  )
}
