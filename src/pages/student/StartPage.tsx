import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StudentLayout } from '@/features/student/components/StudentLayout'
import { describeError } from '@/features/student/errors'
import { paths } from '@/features/student/outline'
import { useClaimLoginCode, useMe } from '@/features/student/queries'
import { CodeSchema } from '@/features/student/validation'

const FormSchema = z.object({ code: CodeSchema })
type FormValues = z.infer<typeof FormSchema>

/**
 * B1: `/start` (type the code) and `/c/:code` (QR target, code pre-filled). A tap is still
 * needed to sign in, so a link preview or prefetch can't claim a code by itself.
 */
export function StartPage() {
  const { code: codeFromLink } = useParams()
  const navigate = useNavigate()
  const me = useMe()
  const claim = useClaimLoginCode()
  const id = useId()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: { code: codeFromLink ?? '' } })

  const serverError = claim.isError ? describeError(claim.error) : null
  const fieldError = errors.code?.message ?? serverError?.message
  const errorId = `${id}-error`

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold">Welcome to Coding in Color</h1>

      {me.data && (
        <Alert>
          <AlertDescription>
            <p>
              This device is signed in as <strong>{me.data.display_name}</strong>.
            </p>
            <Button asChild>
              <Link to={paths.home}>Continue as {me.data.display_name}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sign in with your login code</CardTitle>
          <CardDescription>Your instructor gives you this code. You only need to enter it once on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={handleSubmit((v) => claim.mutate(v.code, { onSuccess: () => navigate(paths.home, { replace: true }) }))}
          >
            <Label htmlFor={`${id}-code`}>Login code</Label>
            <Input
              id={`${id}-code`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. BLUE-FOX-27"
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? errorId : undefined}
              {...register('code')}
            />
            <p id={errorId} role="alert" className="text-sm font-medium text-destructive empty:hidden">
              {fieldError}
              {serverError?.reference && <span className="block text-xs text-muted-foreground">Reference: {serverError.reference}</span>}
            </p>
            <Button type="submit" size="lg" disabled={claim.isPending}>
              {claim.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>No code yet?</CardTitle>
          <CardDescription>Try the free lessons as a guest. Your progress is saved on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/explore">Explore lessons as a guest</Link>
          </Button>
        </CardContent>
      </Card>
    </StudentLayout>
  )
}
