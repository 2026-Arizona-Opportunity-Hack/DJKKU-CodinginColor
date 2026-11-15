// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoSeriousA11yViolations, fakeSupabase, renderAt } from '../test/harness'
import { JoinPage } from '../JoinPage'

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))

const SEATS = [{ member_id: 'm1', label: 'Ava K.' }, { member_id: 'm2', label: 'Jordan T.' }]
const CLAIMED = { class_id: 'c1', class_name: 'Demo Period 1', display_name: 'Ava K.' }
const open = (code = 'DEMO-JOIN-1234') => renderAt(<JoinPage />, { path: '/join/:joinCode', url: `/join/${code}` })

beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321'))

describe('join link', () => {
  it('lists unclaimed names, confirms, claims the seat and goes to /learn', async () => {
    const sb = fakeSupabase({ rpc: { list_join_roster: () => ({ data: SEATS }), claim_roster_seat: () => ({ data: CLAIMED }) } })
    h.sb = sb
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Ava K.' }))
    expect(screen.getByRole('heading', { name: 'Are you Ava K.?' })).toBeInTheDocument()
    expect(sb.auth.signInAnonymously).not.toHaveBeenCalled() // just looking does not use a sign-in
    await userEvent.click(screen.getByRole('button', { name: "Yes, that's me" }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/learn')
    expect(sb.auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(sb.rpc).toHaveBeenCalledWith('claim_roster_seat', { p_join_code: 'DEMO-JOIN-1234', p_member_id: 'm1' })
  })

  it('lets a student go back from the confirmation', async () => {
    h.sb = fakeSupabase({ rpc: { list_join_roster: () => ({ data: SEATS }) } })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Jordan T.' }))
    await userEvent.click(screen.getByRole('button', { name: 'No, go back' }))
    expect(screen.getByRole('button', { name: 'Ava K.' })).toBeInTheDocument()
  })

  it('shows the empty state when every name is taken', async () => {
    h.sb = fakeSupabase({ rpc: { list_join_roster: () => ({ data: [] }) } })
    const { container } = open()
    expect(await screen.findByText(/Everyone in this class has signed in/)).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('shows the bad-link message when the class code is unknown', async () => {
    h.sb = fakeSupabase({ rpc: { list_join_roster: () => ({ error: { code: 'P0001', message: 'That class code was not found' } }) } })
    open()
    expect(await screen.findByText("That class link doesn't work anymore. Ask your instructor for a new one.")).toBeInTheDocument()
  })

  it('does not even ask the database about a code of the wrong length', async () => {
    const sb = fakeSupabase()
    h.sb = sb
    open('ABC')
    expect(await screen.findByText(/class link doesn't work anymore/)).toBeInTheDocument()
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  it('shows the error and a fresh list when the name was taken meanwhile', async () => {
    const sb = fakeSupabase({ rpc: {
      list_join_roster: () => ({ data: SEATS }),
      claim_roster_seat: () => ({ error: { code: 'P0001', message: 'That name was already taken. Ask your instructor.' } }),
    } })
    h.sb = sb
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Ava K.' }))
    await userEvent.click(screen.getByRole('button', { name: "Yes, that's me" }))
    expect(await screen.findByText('That name was already taken. Ask your instructor.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Ava K.' })).toBeInTheDocument()
  })

  it('has one h1 and no serious axe violations with names showing', async () => {
    h.sb = fakeSupabase({ rpc: { list_join_roster: () => ({ data: SEATS }) } })
    const { container } = open()
    await screen.findByRole('button', { name: 'Ava K.' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await expectNoSeriousA11yViolations(container)
  })
})
