// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from '../AdminPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({ listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn() }))
vi.mock('../api', async (orig) => ({ ...(await orig<typeof import('../api')>()), ...m }))
vi.mock('@/lib/session', () => ({ useMe: () => ({ data: { role: 'cic_admin', profile_id: 'me' }, isPending: false }), isDemoMode: () => false }))

const RAW = 'oh_' + 'a'.repeat(64)
const key = (over: object = {}) => ({ id: '50000000-0000-4000-8000-000000000001', name: 'CIC dashboard', scope: ['progress', 'assessments'], created_at: '2026-11-15T18:00:00Z', last_used_at: null, revoked_at: null, ...over })
const open = () => renderAt(<AdminPage />, { url: '/admin/keys' })

beforeEach(() => {
  vi.clearAllMocks()
  m.listApiKeys.mockResolvedValue([key()])
})

describe('API keys', () => {
  it('is a tab of the admin console and lists every key with what it may read', async () => {
    const { container } = open()
    expect(screen.getByRole('link', { name: 'API keys' })).toHaveAttribute('aria-current', 'page')
    const row = await screen.findByRole('row', { name: /CIC dashboard/ })
    expect(row).toHaveTextContent('Completion, Learning gain')
    expect(row).toHaveTextContent('Never') // last used
    expect(row).toHaveTextContent('Active')
    await expectNoSeriousA11yViolations(container)
  })

  it('makes a key and shows it once, with copy, and the list refreshes', async () => {
    m.createApiKey.mockResolvedValue({ api_key_id: 'x', raw_key: RAW })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    open()
    await userEvent.type(await screen.findByLabelText('Name (who or what will use it)'), 'Grant report sheet')
    await userEvent.click(screen.getByRole('checkbox', { name: /Learning gain/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Make key' }))
    expect(m.createApiKey).toHaveBeenCalledWith('Grant report sheet', ['progress'])
    const shown = await screen.findByRole('region', { name: 'Copy the key for "Grant report sheet" now' })
    expect(shown).toHaveFocus()
    expect(within(shown).getByLabelText('API key')).toHaveValue(RAW)
    await userEvent.click(within(shown).getByRole('button', { name: 'Copy key' }))
    expect(writeText).toHaveBeenCalledWith(RAW)
    expect(await within(shown).findByText('Copied.')).toBeInTheDocument()
    await waitFor(() => expect(m.listApiKeys).toHaveBeenCalledTimes(2))
    // Once dismissed, the key is gone from the page for good.
    await userEvent.click(within(shown).getByRole('button', { name: 'Done, I saved it' }))
    expect(screen.queryByDisplayValue(RAW)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make key' })).toBeInTheDocument()
  })

  it('checks the form before asking the database', async () => {
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Make key' }))
    expect(screen.getByText(/Give the key a name/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name (who or what will use it)'), 'Sheet')
    await userEvent.click(screen.getByRole('checkbox', { name: /Completion/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Learning gain/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Make key' }))
    expect(screen.getByText('Choose at least one thing the key may read.')).toBeInTheDocument()
    expect(m.createApiKey).not.toHaveBeenCalled()
  })

  it("shows the database's reason when it refuses", async () => {
    m.createApiKey.mockRejectedValue(new Error('Only a CIC admin can create API keys'))
    open()
    await userEvent.type(await screen.findByLabelText('Name (who or what will use it)'), 'Sheet')
    await userEvent.click(screen.getByRole('button', { name: 'Make key' }))
    expect(await screen.findByText('Only a CIC admin can create API keys')).toBeInTheDocument()
  })

  it('revokes only after asking, and a revoked key shows as revoked with no button', async () => {
    m.revokeApiKey.mockResolvedValue(null)
    open()
    await userEvent.click(within(await screen.findByRole('row', { name: /CIC dashboard/ })).getByRole('button', { name: 'Revoke CIC dashboard' }))
    expect(m.revokeApiKey).not.toHaveBeenCalled()
    const ask = screen.getByRole('group', { name: 'Confirm revoking CIC dashboard' })
    m.listApiKeys.mockResolvedValue([key({ revoked_at: '2026-11-15T19:00:00Z' })])
    await userEvent.click(within(ask).getByRole('button', { name: 'Yes, revoke it' }))
    expect(m.revokeApiKey).toHaveBeenCalledWith('50000000-0000-4000-8000-000000000001')
    expect(await screen.findByText(/Revoked "CIC dashboard"/)).toBeInTheDocument()
    const row = await screen.findByRole('row', { name: /CIC dashboard/ })
    await waitFor(() => expect(row).toHaveTextContent(/Revoked \d/))
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it('can cancel a revoke', async () => {
    open()
    await userEvent.click(within(await screen.findByRole('row', { name: /CIC dashboard/ })).getByRole('button', { name: /Revoke/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(m.revokeApiKey).not.toHaveBeenCalled()
  })

  it('has an empty state and an error state with retry', async () => {
    m.listApiKeys.mockResolvedValueOnce([])
    const first = open()
    expect(await screen.findByText(/No keys yet/)).toBeInTheDocument()
    first.unmount()
    m.listApiKeys.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([])
    open()
    expect(await screen.findByText(/We could not load API keys/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No keys yet/)).toBeInTheDocument()
  })
})
