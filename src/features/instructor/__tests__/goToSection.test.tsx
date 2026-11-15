// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const m = vi.hoisted(() => ({ classes: { isPending: false, data: [] as { id: string; name: string }[] } }))
vi.mock('../hooks', () => ({ useClasses: () => m.classes }))
import { GoToSection } from '../GoToSection'

function go(section: string) {
  const router = createMemoryRouter(
    [{ path: '/instructor/go/:section', element: <GoToSection /> }, { path: '*', element: <p>Landed</p> }],
    { initialEntries: [`/instructor/go/${section}`] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => { m.classes = { isPending: false, data: [{ id: 'c1', name: 'Period 1' }, { id: 'c2', name: 'Period 2' }] } })

describe('/instructor/go/<section>', () => {
  it('opens a page of your first class', () => {
    expect(go('live').state.location.pathname).toBe('/instructor/c1/live')
  })

  it('opens a section of the class page by its anchor', () => {
    const r = go('roster')
    expect(r.state.location.pathname).toBe('/instructor/c1')
    expect(r.state.location.hash).toBe('#roster')
  })

  it('sends someone with no class to the create form, and ignores unknown sections', () => {
    expect(go('nope').state.location.pathname).toBe('/instructor/c1')
    m.classes = { isPending: false, data: [] }
    expect(go('live').state.location.pathname).toBe('/instructor/new')
  })

  it('says it is opening the class while classes load', () => {
    m.classes = { isPending: true, data: [] }
    go('live')
    expect(screen.getByRole('status')).toHaveTextContent('Opening your class')
  })
})
