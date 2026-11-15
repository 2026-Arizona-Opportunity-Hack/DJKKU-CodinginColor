// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { appRoleFromDatabase, roleLandingPath } from '@/lib/authRole'
import { Layout } from './Layout'
import { FeatureAccess } from './FeatureAccess'

const mockedAuth = vi.hoisted(() => ({
  value: { status: 'signedOut' } as { status: string; role?: string; userId?: string; message?: string },
}))

vi.mock('./useAuth', () => ({ useAuth: () => mockedAuth.value }))

afterEach(cleanup)
beforeEach(() => {
  mockedAuth.value = { status: 'signedOut' }
})

describe('role-protected feature access', () => {
  it('hides staff navigation while signed out and redirects direct routes to sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/admin"
              element={
                <FeatureAccess roles={['instructor', 'admin']}>
                  <p>Admin content</p>
                </FeatureAccess>
              }
            />
            <Route path="/sign-in" element={<p>Sign-in page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Sign-in page')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Instructor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('denies a student direct access to staff pages', () => {
    mockedAuth.value = { status: 'signedIn', role: 'student', userId: 'student-id' }
    render(
      <MemoryRouter initialEntries={['/instructor']}>
        <Routes>
          <Route
            path="/instructor"
            element={
              <FeatureAccess roles={['instructor', 'mentor', 'admin']}>
                <p>Instructor content</p>
              </FeatureAccess>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Access restricted' })).toBeInTheDocument()
    expect(screen.queryByText('Instructor content')).not.toBeInTheDocument()
  })

  it('allows an authorized staff role and shows its navigation', () => {
    mockedAuth.value = { status: 'signedIn', role: 'instructor', userId: 'staff-id' }
    render(
      <MemoryRouter initialEntries={['/instructor']}>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/instructor"
              element={
                <FeatureAccess roles={['instructor', 'mentor', 'admin']}>
                  <p>Instructor content</p>
                </FeatureAccess>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Instructor content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Instructor' })).toBeInTheDocument()
  })
})

describe('database role mapping', () => {
  it('maps the database CIC admin role to the app admin role and its landing page', () => {
    const role = appRoleFromDatabase('cic_admin')
    expect(role).toBe('admin')
    expect(role && roleLandingPath(role)).toBe('/admin')
    expect(appRoleFromDatabase('unrecognized')).toBeNull()
  })
})
