import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Award, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/features/player/components/states'
import { QueryView } from '@/features/player/components/QueryView'
import { paths, whole } from '@/features/player/outline'
import { useMe, useMyProgress } from '@/features/player/queries'

/** A printable certificate for a finished module (post-test taken). Shows growth only when it is positive. */
export function CertificatePage() {
  const { classId = '', moduleIndex = '' } = useParams()
  const progress = useMyProgress(classId)
  const me = useMe()
  const [today] = useState(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2 print:hidden">
        <Link to={paths.progress(classId)} className="inline-flex min-h-11 items-center text-primary underline">Back to my progress</Link>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden="true" /> Print or save as PDF
        </Button>
      </div>
      <QueryView query={progress} label="Loading your certificate">
        {(p) => {
          const m = p.modules[Number(moduleIndex)]
          if (!m || m.post_pct === null || m.post_pct === undefined) {
            return (
              <>
              <h1 className="text-2xl font-bold">Certificate</h1>
              <EmptyState title="No certificate yet">
                <p>Finish this module and its post-test, and your certificate will be here.</p>
              </EmptyState>
              </>
            )
          }
          const gain = m.gain !== null && m.gain !== undefined && whole(m.gain) > 0 ? whole(m.gain) : null
          return (
            <section aria-labelledby="cert-title" className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-xl border-4 border-double border-primary p-8 text-center print:border-black">
              <Award aria-hidden="true" className="size-14 text-primary print:text-black" />
              <h1 id="cert-title" className="text-3xl font-bold">Certificate of completion</h1>
              <p className="text-lg">This certifies that</p>
              <p className="text-3xl font-semibold">{me.data?.display_name || 'this student'}</p>
              <p className="text-lg">
                completed <strong>{m.title}</strong> with Coding in Color{me.data?.class_name ? ` (${me.data.class_name})` : ''}.
              </p>
              {gain !== null && m.pre_pct !== null && m.pre_pct !== undefined && (
                <p>
                  From {whole(m.pre_pct)}% on the pre-test to {whole(m.post_pct)}% on the post-test: <strong>+{gain} points</strong> of growth.
                </p>
              )}
              <p className="text-sm text-muted-foreground print:text-black">{today}</p>
            </section>
          )
        }}
      </QueryView>
    </>
  )
}
