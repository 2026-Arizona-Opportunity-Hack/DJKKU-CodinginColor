import { Link, Navigate } from 'react-router'
import { ArrowRight, BarChart3, KeyRound, Target } from 'lucide-react'
import { CicMark } from '@/components/brand/CicLogo'
import { Button } from '@/components/ui/button'
import { homePathFor, isDemoMode, useMe } from '@/lib/session'

// Each step gets one of the theme's three tints (yellow, cyan, green), as in the mockup.
const STEPS = [
  {
    icon: KeyRound,
    title: 'Open the link',
    body: 'Type the code from your card once. No email, no password.',
    card: 'tint-card-yellow',
    tile: 'bg-tint-yellow text-tint-yellow-fg',
  },
  {
    icon: Target,
    title: 'Learn at your pace',
    body: 'Watch, answer a quick check, fill in the worksheet. The next lesson unlocks.',
    card: 'tint-card-cyan',
    tile: 'bg-tint-cyan text-tint-cyan-fg',
  },
  {
    icon: BarChart3,
    title: 'Your instructor sees it',
    body: 'Progress and stuck spots show up on their dashboard, so help comes sooner.',
    card: 'tint-card-green',
    tile: 'bg-tint-green text-tint-green-fg',
  },
] as const

// Signed in: straight to your own home. Signed out (and in demo mode): a short way in.
export function Home() {
  const demo = isDemoMode()
  const me = useMe()
  if (!demo && me.data) return <Navigate to={homePathFor(me.data)} replace />
  if (!demo && me.isPending) return <p role="status">Loading…</p>

  return (
    <div className="flex flex-col gap-(--spacing-section)">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <section aria-labelledby="home-title" className="flex max-w-3xl flex-col gap-5">
          <p className="eyebrow">Self-paced coding for high school</p>
          <h1 id="home-title" className="text-4xl">
            Coding in Color
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Self-paced coding lessons for Coding in Color's classes, with progress your instructor can see.
          </p>
          {demo && (
            <p className="w-fit rounded-lg border border-tint-yellow-edge bg-tint-yellow px-3 py-2 text-sm font-medium text-tint-yellow-fg">
              Demo mode: sample data only, no database is connected.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg">
              <Link to="/sign-in">
                I have a login code <KeyRound aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline"><Link to="/learn/explore">Browse lessons</Link></Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/sign-in#staff">
                Staff sign in <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
        {/* The mark on a frosted tile, as in the mockup. Decorative. */}
        <div aria-hidden="true" className="order-first flex justify-center md:order-none md:px-6">
          <div className="relative grid place-items-center">
            <div className="absolute inset-x-[12%] top-[18%] bottom-[-6%] rounded-3xl border border-white/80 bg-white/60 shadow-md" />
            <CicMark className="relative h-28 drop-shadow-[0_10px_14px_rgb(11_94_49/0.25)] sm:h-36 md:h-52" />
          </div>
        </div>
      </div>

      <section aria-labelledby="how-title" className="flex flex-col gap-5">
        <h2 id="how-title" className="text-2xl">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body, card, tile }, i) => (
            <li key={title} className={`rounded-2xl border bg-card p-5 ${card}`}>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-lg ${tile}`}>
                  <Icon className="size-5" />
                </span>
                <h3 className="text-lg">
                  <span className="sr-only">Step {i + 1}: </span>
                  {title}
                </h3>
              </div>
              <p className="mt-3 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
