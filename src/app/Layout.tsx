import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:p-3 focus:font-medium focus:text-foreground focus:shadow"
      >
        Skip to main content
      </a>
      <header className="border-b print:hidden">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 p-4">
          <NavLink to="/" end className="inline-flex min-h-11 items-center gap-2 font-bold text-primary" aria-label={`${APP_NAME}, home`}>
            <span aria-hidden="true" className="rounded-md bg-primary px-2 py-1 font-mono text-sm text-primary-foreground">{'</>'}</span>
            {APP_NAME}
          </NavLink>
          {visible.map((feature) => (
            <NavLink
              key={feature.id}
              to={feature.path}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center px-1 ${isActive ? 'font-semibold underline' : 'hover:underline'}`
              }
            >
              {feature.label}
            </NavLink>
          ))}
          {demo && <span className="ml-auto text-sm font-medium">Demo mode</span>}
          {!demo && who && (
            <span className="ml-auto flex items-center gap-2 text-sm">
              {who.display_name || who.role} <span aria-hidden="true">·</span>
              <button type="button" className="inline-flex min-h-11 items-center px-1 underline" onClick={() => void onSignOut()}>Sign out</button>
            </span>
          )}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl p-6">
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
    </>
  )
}
