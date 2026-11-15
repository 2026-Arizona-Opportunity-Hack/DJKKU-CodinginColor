import { Button } from '@/components/ui/button'
import { QrImage } from './QrImage'

export type PrintableCode = { display_name: string; login_code: string }

/**
 * One card per student, 2 across and 4 down on a printed page. The codes come from the roster
 * import or a reset and are only ever held in memory: they are not stored anywhere and are
 * gone when the page is closed, so print or save them now.
 */
export function PrintableCodes({ className, codes }: { className: string; codes: PrintableCode[] }) {
  const origin = window.location.origin
  return (
    <section id="login-sheet" aria-labelledby="login-sheet-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 id="login-sheet-title" className="text-xl font-semibold">Login sheet</h2>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <p className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm font-medium text-amber-950 print:hidden">
        These codes are shown only once. Print or save them now.
      </p>
      <ul className="grid grid-cols-2 gap-4 print:gap-3">
        {codes.map((c) => (
          <li
            key={c.login_code}
            className="flex break-inside-avoid items-center gap-4 rounded-lg border p-4 print:h-[2.3in]"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-lg font-semibold">{c.display_name}</p>
              <p className="text-sm">{className}</p>
              <p className="font-mono text-xl font-bold tracking-wider break-all">{c.login_code}</p>
              <p className="text-xs">Go to {origin}/sign-in and type this code.</p>
            </div>
            <QrImage text={`${origin}/sign-in?code=${encodeURIComponent(c.login_code)}`} label={`QR code to sign in as ${c.display_name}`} size={110} />
          </li>
        ))}
      </ul>
    </section>
  )
}
