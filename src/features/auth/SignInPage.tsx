import { useEffect, useId, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { classifyCode } from '@shared/loginCode'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { log } from '@/lib/log'
import {
  ensureAnonymousSession, homePathFor, invalidateMe, isDemoMode, isStaff, signOut, toSessionError, useMe,
} from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import { claimLoginCode } from './api'

const DEMO_NOTE = 'Demo mode: no database is connected, so sign-in is turned off. Open Learn to try the demo student.'

/** The database says "not valid"; the person needs to hear what to do about it. */
const friendly = (message: string) => (/not valid/i.test(message) ? "That code didn't work. Check it with your instructor." : message)

/** M1: a login code for students, Google for teachers, CIC staff and reviewers. */
export function SignInPage() {
  const demo = isDemoMode()
  const id = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hash } = useLocation()
  const [params, setParams] = useSearchParams()
  const me = useMe()
  // Prefill only: a link preview or prefetch must never use up a code by itself.
  const [code, setCode] = useState(params.get('code') ?? '')
  // The code is a password: once it is in the box, take it out of the address bar and history (S-36).
  useEffect(() => {
    if (params.has('code')) setParams((p) => { p.delete('code'); return p }, { replace: true })
  }, [params, setParams])
  const [codeError, setCodeError] = useState<string | null>(null)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [notInvited, setNotInvited] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Coming back from Google: staff go to their home; a Google account nobody invited gets told so.
  const who = me.data
  useEffect(() => {
    if (!who || demo) return
    if (isStaff(who)) {
      navigate(homePathFor(who), { replace: true })
    } else if (who.class_id === null) {
      void (async () => {
        const { data } = await getSupabase().auth.getUser()
        if (!data.user || data.user.is_anonymous || !data.user.email) return
        setNotInvited(data.user.email)
        await signOut().catch((e) => log.warn('auth.signout_failed', { cause: e }))
        await invalidateMe(queryClient)
      })()
    }
  }, [who, demo, navigate, queryClient])

  useEffect(() => {
    if (hash === '#staff') document.getElementById('staff')?.scrollIntoView?.()
  }, [hash])

  async function onStudentSubmit(e: FormEvent) {
    e.preventDefault()
    setCodeError(null)
    const found = classifyCode(code)
    if (found.kind === 'invalid') return setCodeError('That code looks too short or too long.')
    if (found.kind === 'join') return navigate(`/join/${found.code}`)
    setBusy(true)
    try {
      await ensureAnonymousSession()
      await claimLoginCode(code.trim())
      await invalidateMe(queryClient)
      navigate('/learn', { replace: true })
    } catch (err) {
      // The anonymous session stays, so the student can fix a typo and try again without a new sign-in.
      setCodeError(friendly(toSessionError(err).message))
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setStaffError(null)
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/sign-in` },
    })
    if (error) setStaffError(toSessionError(error).message)
  }

  async function onSignOut() {
    try {
      await signOut()
      await invalidateMe(queryClient)
    } catch (err) {
      setCodeError(toSessionError(err).message)
    }
  }

  const signedInStudent = who && !isStaff(who) && who.class_id !== null && !demo

  return (
    // Centred on the screen: horizontally always; vertically in the space under the header
    // (12rem covers the header and the page padding), so on phones it simply scrolls.
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-xl flex-col justify-center gap-6">
      <h1 className="text-center text-3xl font-bold">Sign in</h1>
      {demo && (
        <Alert>
          <AlertDescription>
            <p>{DEMO_NOTE}</p>
          </AlertDescription>
        </Alert>
      )}

      {signedInStudent && (
        <Alert>
          <AlertDescription>
            <p>
              You're signed in as <strong>{who.display_name}</strong> ({who.class_name}).
            </p>
            <div className="flex gap-2">
              <Button asChild><Link to="/learn">Continue</Link></Button>
              <Button variant="outline" onClick={() => void onSignOut()}>Sign out</Button>
            </div>
            <p>If you sign out, your instructor has to give you a new login code.</p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>I'm a student</CardTitle>
          <CardDescription>Type the login code from your card. You only need to do this once on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate className="flex flex-col gap-3" onSubmit={(e) => void onStudentSubmit(e)}>
            <Label htmlFor={`${id}-code`}>Your login code</Label>
            <Input
              id={`${id}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              aria-invalid={Boolean(codeError)}
              aria-describedby={`${id}-code-error`}
            />
            <p id={`${id}-code-error`} role="alert" className="text-sm font-medium text-destructive empty:hidden">{codeError}</p>
            <Button type="submit" size="lg" disabled={busy || demo}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
          <p className="mt-4 text-sm">
            No code? <Link className="inline-flex min-h-11 items-center underline" to="/learn/explore">Browse lessons without an account</Link>
          </p>
        </CardContent>
      </Card>

      <Card id="staff">
        <CardHeader>
          <CardTitle>I'm a teacher, CIC staff or reviewer</CardTitle>
          <CardDescription>Use the Google account your invitation was sent to.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" variant="outline" disabled={demo} onClick={() => void onGoogle()}>Sign in with Google</Button>
          <div role="alert" className="empty:hidden">
            {notInvited && (
              <p className="text-sm font-medium text-destructive">
                This Google account hasn't been invited yet. Ask a CIC admin to invite {notInvited}.
              </p>
            )}
            {staffError && <p className="text-sm font-medium text-destructive">{staffError}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
