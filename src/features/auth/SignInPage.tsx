import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, BookOpen, KeyRound, Sparkles } from 'lucide-react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { appRoleFromDatabase, roleLandingPath } from '@/lib/authRole'
import { getSupabase } from '@/lib/supabase'

const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter the name you would like your instructor to see.')
  .max(80, 'Use 80 characters or fewer.')
  .refine((value) => !value.includes('@'), 'Leave out email addresses.')

const LoginCodeSchema = z
  .string()
  .trim()
  .max(80, 'Check the code and try again.')
  .refine((value) => value.replace(/[^a-z0-9]/gi, '').length >= 12, 'Enter the full login code from your instructor.')

const StudentContextSchema = z.object({
  role: z.enum(['student', 'independent_student']),
  display_name: z.string(),
  class_id: z.string().uuid().nullable(),
})

const ClassResultSchema = z.object({ class_id: z.string().uuid() })
const RegistrationResultSchema = ClassResultSchema.extend({ login_code: z.string().min(1) })

type Status = { message: string; kind: 'error' | 'success' }

const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

function firstRecord(value: unknown): unknown {
  const record = Array.isArray(value) ? value[0] : value
  return typeof record === 'object' && record !== null && !Array.isArray(record) ? record : null
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    if (error.message.includes('not valid')) return 'That login code was not recognized. Check it or ask your instructor for a new one.'
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

function learningPath(classId: string): string {
  return `/learn/${encodeURIComponent(classId)}`
}

export function SignInPage() {
  const navigate = useNavigate()
  const nameInput = useRef<HTMLInputElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [displayName, setDisplayName] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [issuedClassId, setIssuedClassId] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let active = true
    void (async () => {
      try {
        const client = getSupabase()
        const { data, error } = await client.auth.getSession()
        if (error) throw error
        if (!data.session) return
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .maybeSingle()
        if (profileError) throw profileError
        const role = appRoleFromDatabase(profile?.role)
        if (!role) throw new Error('Your account does not have an approved role.')
        const landingPath = roleLandingPath(role)
        if (active && landingPath) {
          navigate(landingPath, { replace: true })
          return
        }
        if (
          active &&
          data.session.user.app_metadata.provider === 'google' &&
          (role === 'student' || role === 'independent_student')
        ) {
          setStatus({ message: 'This Google account is not approved for staff access. Students use a personal login code.', kind: 'error' })
          return
        }
        const context = await loadStudentContext(client)
        if (active && context?.class_id) {
          navigate(learningPath(context.class_id), { replace: true })
        }
      } catch (error) {
        if (active) setStatus({ message: getErrorMessage(error), kind: 'error' })
      }
    })()
    return () => {
      active = false
    }
  }, [navigate])

  function changeMode(next: 'signin' | 'signup') {
    setMode(next)
    setStatus(null)
    setIssuedCode(null)
    setIssuedClassId(null)
  }

  async function getOrCreateSession(displayNameForSession: string) {
    const client = getSupabase()
    const { data: current, error: sessionError } = await client.auth.getSession()
    if (sessionError) throw sessionError
    if (current.session) return { client, existingSession: true }

    const { data, error } = await client.auth.signInAnonymously({
      options: { data: { display_name: displayNameForSession } },
    })
    if (error) throw error
    if (!data.session) throw new Error('A student session could not be started. Please try again.')
    return { client, existingSession: false }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(null)

    const name = displayName.trim()
    const code = loginCode.trim()
    if (mode === 'signup') {
      const parsedName = DisplayNameSchema.safeParse(name)
      if (!parsedName.success) {
        setStatus({ message: parsedName.error.issues[0]?.message ?? 'Enter your name.', kind: 'error' })
        nameInput.current?.focus()
        return
      }
    }
    if (mode === 'signin' || code) {
      const parsedCode = LoginCodeSchema.safeParse(code)
      if (!parsedCode.success) {
        setStatus({ message: parsedCode.error.issues[0]?.message ?? 'Enter your login code.', kind: 'error' })
        codeInput.current?.focus()
        return
      }
    }

    setBusy(true)
    try {
      const { client, existingSession } = await getOrCreateSession(mode === 'signup' ? name : 'Student')
      if (existingSession) {
        const current = await loadStudentContext(client)
        if (current?.class_id) {
          navigate(learningPath(current.class_id))
          return
        }
      }

      if (mode === 'signin' || code) {
        const { data, error } = await client.rpc('claim_login_code', { p_code: code })
        if (error) throw error
        const claimed = ClassResultSchema.safeParse(firstRecord(data))
        if (!claimed.success) throw new Error('The login code was accepted but your class could not be loaded.')
        navigate(learningPath(claimed.data.class_id))
        return
      }

      const { data, error } = await client.rpc('self_register', { p_display_name: name })
      if (error) throw error
      const registration = RegistrationResultSchema.safeParse(firstRecord(data))
      if (!registration.success) throw new Error('Your account was created, but its login code could not be loaded.')
      setIssuedCode(registration.data.login_code)
      setIssuedClassId(registration.data.class_id)
    } catch (error) {
      setStatus({ message: getErrorMessage(error), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function onGuestSignIn() {
    setStatus(null)
    setBusy(true)
    try {
      const { client, existingSession } = await getOrCreateSession('Guest')
      if (existingSession) {
        const current = await loadStudentContext(client)
        if (current?.class_id) {
          navigate(learningPath(current.class_id))
          return
        }
      }
      const { data, error } = await client.rpc('guest_sign_in', { p_display_name: 'Guest' })
      if (error) throw error
      const guest = ClassResultSchema.safeParse(firstRecord(data))
      if (!guest.success) throw new Error('Guest access is not ready yet. Ask your teacher for help.')
      navigate(learningPath(guest.data.class_id))
    } catch (error) {
      setStatus({ message: getErrorMessage(error), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function onGoogleSignIn() {
    setStatus(null)
    setBusy(true)
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/sign-in` },
      })
      if (error) throw error
      setStatus({ message: 'Opening Google sign-in…', kind: 'success' })
    } catch (error) {
      setStatus({ message: getErrorMessage(error), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (issuedCode) {
    return (
      <section className="mx-auto max-w-lg py-10" aria-labelledby="account-ready-title">
        <Card className="border-primary/30 shadow-md">
          <CardHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-xl bg-secondary text-primary" aria-hidden="true">
              <KeyRound />
            </div>
            <h1 id="account-ready-title" className="text-2xl leading-tight font-semibold">Your account is ready</h1>
            <CardDescription>Your learning account is ready. Write down this personal login code; it is shown only once.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="rounded-lg bg-secondary p-4 text-center font-mono text-2xl font-bold tracking-widest text-secondary-foreground break-all">
              {issuedCode}
            </p>
            <Button size="lg" onClick={() => issuedClassId && navigate(learningPath(issuedClassId))}>
              Continue to lessons <ArrowRight aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-5xl items-center gap-8 py-8 lg:grid-cols-2 lg:gap-12">
      <section className="mx-auto w-full max-w-md" aria-labelledby="welcome-title">
        <div className="mb-6">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            YOUR LEARNING SPACE
          </p>
          <h1 id="welcome-title" className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Big ideas start with <span className="text-primary">a first step.</span>
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Sign in to pick up where you left off, or join your class and start exploring.
          </p>
        </div>

        <Card className="gap-0 border-border/70 shadow-lg">
          <CardHeader className="pb-0">
            <div className="grid grid-cols-2 border-b" role="tablist" aria-label="Account options">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                className={`min-h-11 border-b-2 px-2 text-sm font-semibold focus-visible:outline-ring ${mode === 'signin' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => changeMode('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`min-h-11 border-b-2 px-2 text-sm font-semibold focus-visible:outline-ring ${mode === 'signup' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => changeMode('signup')}
              >
                Create account
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {!hasSupabaseConfig && (
              <Alert variant="warning" className="mb-4">
                <AlertDescription>
                  Connect Supabase by copying <code>.env.example</code> to <code>.env</code> and adding your project URL and anon key.
                </AlertDescription>
              </Alert>
            )}
            {status && (
              <Alert variant={status.kind === 'error' ? 'destructive' : 'success'} className="mb-4" role={status.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}

            <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
              {mode === 'signup' && (
                <div className="grid gap-2">
                  <Label htmlFor="display-name">Your name</Label>
                  <Input
                    ref={nameInput}
                    id="display-name"
                    autoComplete="name"
                    maxLength={80}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="How should we call you?"
                    disabled={busy}
                    required
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="login-code">Personal login code{mode === 'signup' ? ' (optional)' : ''}</Label>
                <Input
                  ref={codeInput}
                  id="login-code"
                  autoComplete="one-time-code"
                  value={loginCode}
                  onChange={(event) => setLoginCode(event.target.value)}
                  placeholder="Enter the code from your instructor"
                  disabled={busy}
                  required={mode === 'signin'}
                  aria-describedby="code-help"
                />
                <p id="code-help" className="text-xs text-muted-foreground">
                  {mode === 'signup'
                    ? 'Use a class login code to claim your roster seat. Leave blank to join CIC Open.'
                    : 'Ask your instructor for your personal code if you do not have one.'}
                </p>
              </div>
              <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy}>
                {busy ? 'One moment…' : mode === 'signin' ? 'Sign in to learn' : 'Create my account'}
                {!busy && <ArrowRight aria-hidden="true" />}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[10px] font-bold tracking-widest text-muted-foreground/70">
              <span className="h-px flex-1 bg-border" />
              OR
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Just looking around?</p>
                <p className="text-xs text-muted-foreground">Explore as a guest. No login code needed.</p>
              </div>
              <Button type="button" variant="outline" className="shrink-0" disabled={busy} onClick={onGuestSignIn}>
                Continue as guest <ArrowRight aria-hidden="true" />
              </Button>
            </div>
            <details className="mt-4 rounded-md px-1 text-xs text-muted-foreground">
              <summary className="min-h-11 cursor-pointer py-3 font-medium text-primary focus-visible:outline-ring">
                Lost your login code?
              </summary>
              <p className="pb-3 leading-relaxed">
                Ask your instructor to reset your personal code. For privacy, student accounts do not use email or password reset.
              </p>
            </details>
            <div className="mt-3 border-t pt-4">
              <p className="mb-3 text-center text-xs text-muted-foreground">For instructors and staff</p>
              <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={onGoogleSignIn}>
                Sign in with Google
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <aside
        className="relative hidden min-h-[34rem] overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-700 to-indigo-950 p-10 text-white shadow-xl lg:flex lg:flex-col lg:justify-center"
        aria-label="A preview of learning activities"
      >
        <div className="absolute -right-20 -top-32 size-96 rounded-full border border-white/15" aria-hidden="true" />
        <div className="absolute -right-8 -top-20 size-72 rounded-full border border-white/10" aria-hidden="true" />
        <div className="relative">
          <p className="text-xs font-bold tracking-[0.18em] text-violet-200">LEARN BY DOING</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight">Small steps.<br />Bright ideas.</h2>
          <div className="mt-9 max-w-sm rotate-[-1deg] rounded-2xl border border-white/70 bg-white p-6 text-foreground shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Sparkles size={18} aria-hidden="true" /></span>
              <p className="text-xs font-bold tracking-wider text-muted-foreground">YOUR NEXT ACTIVITY</p>
              <BookOpen className="ml-auto text-muted-foreground" size={18} aria-hidden="true" />
            </div>
            <p className="mt-5 font-bold">Variables &amp; Loops</p>
            <p className="mt-1 text-sm text-muted-foreground">Give your ideas a place to grow.</p>
            <pre className="mt-4 overflow-hidden rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code><span className="text-violet-300">score</span> = <span className="text-amber-300">3</span>{'\n'}<span className="text-sky-300">for</span> n <span className="text-sky-300">in</span> <span className="text-emerald-300">range</span>(3):{'\n'}  print(n)</code></pre>
            <div className="mt-5 flex justify-between text-[10px] font-bold tracking-wider text-muted-foreground">
              <span>YOUR MOMENTUM</span><span className="text-primary">1 OF 4</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full w-[31%] rounded-full bg-violet-500" /></div>
          </div>
          <p className="mt-8 text-sm text-violet-100">✦ &nbsp; A little progress adds up.</p>
        </div>
      </aside>
    </div>
  )
}

async function loadStudentContext(client: ReturnType<typeof getSupabase>) {
  const { data, error } = await client.rpc('student_login_context')
  if (error) throw error
  const record = firstRecord(data)
  if (record === null) return null
  const parsed = StudentContextSchema.safeParse(record)
  if (!parsed.success) throw new Error('Student account details could not be loaded. Please try again.')
  return parsed.data
}
