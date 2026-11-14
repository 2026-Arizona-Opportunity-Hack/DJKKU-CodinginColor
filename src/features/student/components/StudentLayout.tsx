import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'

import type { Me } from '../api'
import { useSignOut } from '../queries'

/** Page shell: skip link, header with "Not you? Sign out" (ADR 0004), one <main>. */
export function StudentLayout({ me, children }: { me?: Me | null; children: ReactNode }) {
  const signOut = useSignOut()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <header className="border-b bg-secondary">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link to={me ? '/learn' : '/'} className="inline-flex min-h-11 items-center font-semibold text-secondary-foreground">
            Coding in Color
          </Link>
          {me && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Signed in as <strong>{me.display_name}</strong>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={signOut.isPending}
                onClick={() => signOut.mutate(undefined, { onSettled: () => navigate('/start') })}
              >
                Not you? Sign out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 outline-none">
        {children}
      </main>
    </div>
  )
}
