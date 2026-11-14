import { NavLink, Outlet } from 'react-router'
import { features } from './features'

// The shared page frame: skip link, nav landmark, and the single <main>.
export function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-white focus:p-2"
      >
        Skip to main content
      </a>
      <header className="border-b">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap gap-4 p-4">
          <NavLink to="/" end className="font-bold">
            Coding in Color
          </NavLink>
          {features.map((feature) => (
            <NavLink
              key={feature.id}
              to={feature.path}
              className={({ isActive }) =>
                isActive ? 'font-semibold underline' : 'hover:underline'
              }
            >
              {feature.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </>
  )
}
