// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const session = vi.hoisted(() => ({ me: null as unknown }))
vi.mock('@/lib/session', async (orig) => ({
  ...(await orig<typeof import('@/lib/session')>()),
  useMe: () => ({ data: session.me, isPending: false }),
  isDemoMode: () => false,
}))
import { Guide } from './Guide'

const show = () => {
  const router = createMemoryRouter([{ path: '/guide', element: <Guide /> }, { path: '*', element: <p>Landed</p> }], { initialEntries: ['/guide'] })
  return { ...render(<RouterProvider router={router} />), router }
}

beforeEach(() => { session.me = null })
afterEach(() => cleanup())

describe('Guide', () => {
  it('opens on your own role, with numbered first steps and links straight to each feature', async () => {
    session.me = { role: 'instructor', can_author: true, profile_id: 'p', display_name: 'T', class_id: null, class_name: null }
    const { router } = show()
    expect(screen.getByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Instructor/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Author/ })).toHaveTextContent('you')
    expect(screen.getByRole('heading', { name: 'Your first steps' })).toBeInTheDocument()
    const live = screen.getByRole('link', { name: 'Go there: Live class view' })
    expect(live).toHaveAttribute('href', '/instructor/go/live')
    await userEvent.click(live)
    expect(router.state.location.pathname).toBe('/instructor/go/live')
  })

  it('moves between roles with the arrow keys and shows each role its own features', async () => {
    show()
    const visitor = screen.getByRole('tab', { name: /Visitor/ })
    expect(visitor).toHaveAttribute('aria-selected', 'true')
    visitor.focus()
    await userEvent.keyboard('{ArrowRight}')
    const student = screen.getByRole('tab', { name: /Student/ })
    expect(student).toHaveFocus()
    expect(student).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'My notebook' })).toBeInTheDocument()
    expect(screen.getAllByText(/You need the Student role for this/).length).toBeGreaterThan(0)
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: /Reviewer/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: /Mentor/ })).not.toBeInTheDocument()
  })

  it('searches every role at once and says when nothing matches', async () => {
    show()
    await userEvent.type(screen.getByLabelText('Search features'), 'reteach')
    expect(screen.getByRole('heading', { name: '1 feature matches' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go there: What to reteach' })).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Search features'))
    await userEvent.type(screen.getByLabelText('Search features'), 'zzzz')
    expect(screen.getByRole('heading', { name: 'Nothing matches "zzzz"' })).toBeInTheDocument()
  })

  it('has no serious accessibility problems', async () => {
    const { container } = show()
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  })
})
