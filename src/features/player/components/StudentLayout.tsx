import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'

import type { Me } from '../api'
import { paths } from '../outline'
import { useSignOut } from '../queries'

/**
 * Lane B page body. The app Layout already provides the skip link, nav and the only
 * <main>; this adds the "Signed in as … / Not you? Sign out" bar (ADR 0004).
 */
export function StudentLayout({ me, children }: { me?: Me | null; children: ReactNode }) {
  const signOut = useSignOut()
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {me && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground shadow-xs [&_strong]:text-foreground">
          <span>
            {me.display_name ? (
              <>
                Signed in as <strong>{me.display_name}</strong>
              </>
            ) : (
              'Signed in'
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate(undefined, { onSettled: () => navigate(paths.signIn) })}
          >
            Not you? Sign out
          </Button>
        </div>
      )}
      {children}
    </div>
  )
}
