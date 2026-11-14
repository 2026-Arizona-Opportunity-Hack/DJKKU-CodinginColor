import { useEffect, useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { z } from 'zod'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StudentLayout } from '@/features/player/components/StudentLayout'
import { InlineError } from '@/features/player/components/InlineError'
import { describeError } from '@/features/player/errors'
import { paths } from '@/features/player/outline'
import { useSaveGuestProgress, type SavedAccount } from '@/features/player/queries'
import { DisplayNameSchema } from '@/features/player/validation'

const FormSchema = z.object({ display_name: DisplayNameSchema })
type FormValues = z.input<typeof FormSchema>

/** B4: guest → account with a display name only; shows the personal login code once. */
export function SaveProgressPage() {
  const save = useSaveGuestProgress()
  const id = useId()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: { display_name: '' } })

  if (save.data) return <CodeReveal account={save.data} />

  const serverError = save.isError ? describeError(save.error) : null
  const fieldError = errors.display_name?.message ?? (serverError?.code === 'invalid_name' ? serverError.message : undefined)
  const errorId = `${id}-error`

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold">Save my progress</h1>
      <Card>
        <CardHeader>
          <CardTitle>Choose the name your instructor will see</CardTitle>
          <CardDescription>A first name and last initial is enough. Don't use your email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={handleSubmit((v) => {
              if (!save.isPending) save.mutate(v.display_name.trim())
            })}
          >
            <Label htmlFor={`${id}-name`}>Display name</Label>
            <Input
              id={`${id}-name`}
              autoComplete="nickname"
              maxLength={60}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? errorId : undefined}
              {...register('display_name')}
            />
            <p id={errorId} role="alert" className="text-sm font-medium text-destructive empty:hidden">
              {fieldError}
            </p>
            <Button type="submit" size="lg" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save my progress'}
            </Button>
          </form>
          <div aria-live="polite" className="mt-3">
            {serverError && serverError.code !== 'invalid_name' && (
              <InlineError error={serverError} />
            )}
          </div>
        </CardContent>
      </Card>
      <Link to={paths.explore} className="inline-flex min-h-11 items-center text-primary underline">
        Back to lessons
      </Link>
    </StudentLayout>
  )
}

function CodeReveal({ account }: { account: SavedAccount }) {
  const heading = useRef<HTMLHeadingElement>(null)
  // Move focus to the result so screen readers hear the code right away.
  useEffect(() => heading.current?.focus(), [])

  return (
    <StudentLayout>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
        Your progress is saved
      </h1>
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle>Your personal login code</CardTitle>
          <CardDescription>Write this down or print it. We only show it once.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="rounded-md bg-secondary p-4 text-center font-mono text-3xl font-bold tracking-widest break-all text-secondary-foreground">
            {account.login_code}
          </p>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
              Print my code
            </Button>
            <Button asChild>
              <Link to={paths.home}>Keep learning</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      {account.importFailed ? (
        <Alert variant="warning">
          <AlertTitle>Your account is ready, but your guest progress didn't copy over</AlertTitle>
          <AlertDescription>
            <p>It's still on this device. Ask your instructor to help move it.</p>
          </AlertDescription>
        </Alert>
      ) : (
        account.imported > 0 && (
          <p>
            We copied {account.imported} finished {account.imported === 1 ? 'activity' : 'activities'} to your account.
          </p>
        )
      )}
    </StudentLayout>
  )
}
