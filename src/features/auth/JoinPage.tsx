import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { classifyCode } from '@shared/loginCode'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ensureAnonymousSession, invalidateMe, isDemoMode, toSessionError } from '@/lib/session'
import { claimRosterSeat, listJoinRoster, type Seat } from './api'

const BAD_LINK = "That class link doesn't work anymore. Ask your instructor for a new one."

/** `/join/:joinCode`: a class join link lists the names nobody has claimed yet; pick yours. */
export function JoinPage() {
  const { joinCode = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const validCode = classifyCode(joinCode).kind === 'join'
  const [picked, setPicked] = useState<Seat | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const confirmRef = useRef<HTMLHeadingElement>(null)

  const roster = useQuery({
    queryKey: ['join-roster', joinCode],
    // Readable without any session (the anon key is enough), so just looking at the list
    // does not use up one of the network's limited anonymous sign-ins.
    queryFn: () => listJoinRoster(joinCode),
    enabled: validCode && !isDemoMode(),
    retry: false,
  })
  useEffect(() => { if (picked) confirmRef.current?.focus() }, [picked])

  async function claim(seat: Seat) {
    setBusy(true)
    setClaimError(null)
    try {
      await ensureAnonymousSession()
      await claimRosterSeat(joinCode, seat.member_id)
      await invalidateMe(queryClient)
      navigate('/learn', { replace: true })
    } catch (err) {
      setClaimError(toSessionError(err).message)
      setPicked(null)
      void roster.refetch() // someone may have taken the name meanwhile
    } finally {
      setBusy(false)
    }
  }

  const loadError = roster.error ? toSessionError(roster.error) : null
  const badLink = !validCode || loadError?.code === 'not_found'

  let body
  if (isDemoMode()) {
    body = <p>Demo mode: no database is connected, so class links are turned off.</p>
  } else if (badLink) {
    body = <p role="alert">{BAD_LINK}</p>
  } else if (loadError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p>{loadError.message}</p>
        <Button variant="outline" onClick={() => void roster.refetch()}>Try again</Button>
      </div>
    )
  } else if (roster.isPending) {
    body = <p role="status">Loading your class list…</p>
  } else if (picked) {
    body = (
      <section aria-labelledby="confirm-title" className="flex flex-col gap-3">
        <h2 id="confirm-title" ref={confirmRef} tabIndex={-1} className="text-lg font-semibold">Are you {picked.label}?</h2>
        <div className="flex gap-2">
          <Button size="lg" disabled={busy} onClick={() => void claim(picked)}>{busy ? 'Signing in…' : "Yes, that's me"}</Button>
          <Button size="lg" variant="outline" disabled={busy} onClick={() => setPicked(null)}>No, go back</Button>
        </div>
      </section>
    )
  } else if ((roster.data ?? []).length === 0) {
    body = (
      <p>
        Everyone in this class has signed in. Ask your instructor for your login code, then{' '}
        <Link className="underline" to="/sign-in">type it here</Link>.
      </p>
    )
  } else {
    body = (
      <section aria-labelledby="pick-name" className="flex flex-col gap-3">
        <h2 id="pick-name" className="text-lg font-semibold">Which one is you?</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(roster.data ?? []).map((seat) => (
            <li key={seat.member_id}>
              <Button variant="outline" size="lg" className="w-full justify-start" onClick={() => setPicked(seat)}>{seat.label}</Button>
            </li>
          ))}
        </ul>
        <p className="text-sm">Not on the list? Ask your instructor for a login code.</p>
      </section>
    )
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Join your class</h1>
      <div aria-live="polite">
        {claimError && (
          <Alert variant="destructive"><AlertDescription><p>{claimError}</p></AlertDescription></Alert>
        )}
      </div>
      {body}
    </div>
  )
}

