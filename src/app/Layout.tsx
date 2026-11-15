import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { CicLogo } from '@/components/brand/CicLogo'
import { canSeeFeature, invalidateMe, isDemoMode, signOut, useMe } from '@/lib/session'
import { features } from './features'
import { APP_NAME, pageTitle } from './titles'

// The shared page frame: skip link, nav landmark, and the single <main>.
// Which links show depends on who is signed in. That is navigation only: row-level security
// in the database decides what anyone can actually read or change.
export function Layout() {
  const demo = isDemoMode()
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const who = me.data ?? null
  const visible = demo ? features.filter((f) => f.showSignedOut !== 'only') : features.filter((f) => canSeeFeature(f, who))

  // A friendly stop for the wrong role. Public features (the player) and the sign-in pages are never blocked.
  const current = features.find((f) => [f.path, ...(f.extraPaths ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`)))
  const guarded = !demo && current?.roles && !current.showSignedOut
  const denied = guarded && !me.isPending && !canSeeFeature(current, who)

  useEffect(() => {
    document.title = pageTitle(pathname)
  }, [pathname])

  async function onSignOut() {
    await signOut()
    await invalidateMe(queryClient)
    navigate('/')
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:p-3 focus:text-foreground focus:shadow-md"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/70 bg-background/75 backdrop-blur-md print:hidden">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-(--spacing-gutter) py-2"
        >
          <NavLink
            to="/"
            end
            className="mr-4 inline-flex min-h-11 items-center rounded-md sm:order-1"
            aria-label={`${APP_NAME}, home`}
          >
            <CicLogo />
          </NavLink>
          {demo && (
            <span className="ml-auto rounded-full border border-tint-yellow-edge bg-tint-yellow px-2.5 py-0.5 text-xs font-semibold text-tint-yellow-fg sm:order-3 sm:ml-3">
              Demo mode
            </span>
          )}
          {!demo && who && (
            <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground sm:order-3 sm:ml-3">
              {who.display_name || who.role} <span aria-hidden="true">·</span>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-md px-1 text-foreground underline"
                onClick={() => void onSignOut()}
              >
                Sign out
              </button>
            </span>
          )}
          <div className="-mx-2.5 flex w-[calc(100%+1.25rem)] flex-wrap items-center gap-0.5 sm:order-2 sm:mx-0 sm:ml-auto sm:w-auto">
            {visible.map((feature) => (
              <NavLink
                key={feature.id}
                to={feature.path}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium transition-colors sm:px-3 ${
                    isActive
                      ? 'font-semibold text-secondary-foreground underline decoration-brand-green decoration-2 underline-offset-8'
                      : 'text-foreground hover:bg-white/70'
                  }`
                }
              >
                {feature.label}
              </NavLink>
            ))}
            <NavLink
              to="/guide"
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium transition-colors sm:px-3 ${
                  isActive
                    ? 'font-semibold text-secondary-foreground underline decoration-brand-green decoration-2 underline-offset-8'
                    : 'text-foreground hover:bg-white/70'
                }`
              }
            >
              Guide
            </NavLink>
          </div>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-(--spacing-gutter) py-8 sm:py-10">
        {guarded && me.isPending ? (
          <p role="status">Loading…</p>
        ) : denied ? (
          <section className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold">You don't have access to this page</h1>
            <p>
              {who ? 'Your account does not have the role this page is for.' : 'Sign in to see this page.'}{' '}
              <Link className="underline" to={who ? '/' : '/sign-in'}>{who ? 'Go to your home page' : 'Sign in'}</Link>
            </p>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 border-t px-(--spacing-gutter) py-6 text-sm text-muted-foreground print:hidden">
        <span>Coding in Color Learn</span>
        <Link className="inline-flex min-h-11 items-center underline" to="/privacy">Privacy</Link>
        <a className="inline-flex min-h-11 items-center underline" href="https://github.com/2026-Arizona-Opportunity-Hack/DJKKU-CodinginColor/blob/main/SECURITY.md" rel="noopener noreferrer">Security</a>
      </footer>
    </>
  )
}
