import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assignModule, createClass, createJoinCode, listClassModules, listPublishedModules } from '../setupApi'

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))

const ID = '20000000-0000-4000-8000-000000000001'
/** A client whose rpc() and from().select()... chains end in `result`. */
function client(result: { data?: unknown; error?: unknown }) {
  const done = { error: null, data: null, ...result }
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) chain[m] = vi.fn(() => chain)
  chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(done).then(ok)
  const sb = { rpc: vi.fn(async () => done), from: vi.fn(() => chain) }
  h.sb = sb
  return { sb, chain }
}

beforeEach(() => vi.unstubAllEnvs())

describe('writes go through the database functions', () => {
  it('create_class sends the trimmed form and returns the new class id', async () => {
    const { sb } = client({ data: { class_id: ID } })
    expect(await createClass({ schoolName: 'Maryvale', name: 'Period 1' })).toEqual({ class_id: ID })
    expect(sb.rpc).toHaveBeenCalledWith('create_class', { p_school_name: 'Maryvale', p_name: 'Period 1', p_term: null })
  })

  it("says an unknown school isn't set up, in plain words", async () => {
    client({ error: { code: 'P0001', message: 'That school is not set up yet. Ask a CIC admin to add it.' } })
    await expect(createClass({ schoolName: 'Nowhere', name: 'x' })).rejects.toThrow("That school isn't set up yet. Ask a CIC admin to add it.")
  })

  it('create_join_code and assign_module use the contract argument names', async () => {
    const a = client({ data: { join_code: 'AAAA-BBBB-CCCC' } })
    expect(await createJoinCode(ID)).toEqual({ join_code: 'AAAA-BBBB-CCCC' })
    expect(a.sb.rpc).toHaveBeenCalledWith('create_join_code', { p_class_id: ID })
    const b = client({ data: null })
    await assignModule(ID, 'm1')
    expect(b.sb.rpc).toHaveBeenCalledWith('assign_module', { p_class_id: ID, p_module_id: 'm1' })
  })
})

describe('reads', () => {
  it('lists published modules only, newest version first', async () => {
    const { chain } = client({ data: [{ id: ID, title: 'Variables and Loops', version: 2 }] })
    expect(await listPublishedModules()).toEqual([{ id: ID, title: 'Variables and Loops', version: 2 }])
    expect(chain.eq).toHaveBeenCalledWith('status', 'published')
  })

  it("flattens a class's modules in position order", async () => {
    const { chain } = client({ data: [{ position: 0, module_id: ID, modules: { title: 'Variables and Loops', version: 1 } }] })
    expect(await listClassModules('c1')).toEqual([{ position: 0, moduleId: ID, title: 'Variables and Loops', version: 1 }])
    expect(chain.order).toHaveBeenCalledWith('position')
  })

  it('turns a database failure into a message, not a crash', async () => {
    client({ error: { code: '42501', message: 'permission denied' } })
    await expect(listPublishedModules()).rejects.toThrow(/signed out/)
  })
})
