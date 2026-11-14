import { Link, useNavigate, useParams } from 'react-router'

import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { QueryView } from '@/features/student/components/QueryView'
import { StudentLayout } from '@/features/student/components/StudentLayout'
import { InlineError } from '@/features/student/components/InlineError'
import { describeError } from '@/features/student/errors'
import { paths } from '@/features/student/outline'
import { useClaimRosterSeat, useJoinRoster } from '@/features/student/queries'

/** B2: `/join/:joinCode` lists unclaimed names (first name + last initial); pick yours to sign in. */
export function JoinPage() {
  const { joinCode = '' } = useParams()
  const navigate = useNavigate()
  const roster = useJoinRoster(joinCode)
  const claim = useClaimRosterSeat(joinCode)
  const claimError = claim.isError ? describeError(claim.error) : null

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold">Join your class</h1>
      <QueryView query={roster} label="Loading your class list">
        {(seats) =>
          seats.length === 0 ? (
            <EmptyState title="Everyone on this list has signed in">
              <p>Ask your instructor for your personal login code.</p>
              <Button asChild variant="outline">
                <Link to="/start">Enter a login code</Link>
              </Button>
            </EmptyState>
          ) : (
            <section aria-labelledby="pick-name" className="flex flex-col gap-3">
              <h2 id="pick-name" className="text-lg font-semibold">
                Which one is you?
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {seats.map((seat) => (
                  <li key={seat.member_id}>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full justify-start"
                      disabled={claim.isPending}
                      onClick={() =>
                        claim.mutate(seat.member_id, {
                          onSuccess: () => navigate(paths.home, { replace: true }),
                          // Someone may have taken the seat meanwhile; show the current list.
                          onError: () => void roster.refetch(),
                        })
                      }
                    >
                      I'm {seat.label}
                    </Button>
                  </li>
                ))}
              </ul>
              <div aria-live="polite">
                {claimError && (
                  <InlineError error={claimError} />
                )}
              </div>
              <p className="text-sm text-muted-foreground">Not on the list? Ask your instructor for a login code.</p>
            </section>
          )
        }
      </QueryView>
    </StudentLayout>
  )
}
