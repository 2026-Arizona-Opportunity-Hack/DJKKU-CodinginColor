import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunRequest, RunResponse } from './protocol'
import { createRunner } from './runner'

class FakeWorker {
  static all: FakeWorker[] = []
  onmessage: ((e: MessageEvent<RunResponse>) => void) | null = null
  sent: RunRequest[] = []
  terminated = false
  constructor() { FakeWorker.all.push(this) }
  postMessage(m: RunRequest) { this.sent.push(m) }
  terminate() { this.terminated = true }
  reply(r: Record<string, unknown>) {
    const id = this.sent.at(-1)!.id
    this.onmessage?.({ data: { id, stdout: '', error: null, checks: [], ...r } } as unknown as MessageEvent<RunResponse>)
  }
}

const make = () => createRunner(() => new FakeWorker(), { run: 5000, first: 60000 })

beforeEach(() => { FakeWorker.all = []; vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())

describe('createRunner', () => {
  it('sends the code and tests and returns the output', async () => {
    const runner = make()
    const p = runner.run('print(2)', ['assert True'])
    const w = FakeWorker.all[0]!
    expect(w.sent[0]).toMatchObject({ code: 'print(2)', tests: ['assert True'] })
    w.reply({ ok: true, stdout: '2\n', checks: [{ test: 'assert True', passed: true }] })
    await expect(p).resolves.toEqual({ kind: 'ok', stdout: '2\n', error: null, checks: [{ test: 'assert True', passed: true }] })
  })

  it('stops a run that goes over 5 seconds and starts a fresh worker next time', async () => {
    const runner = make()
    const first = runner.run('print(1)', [])
    FakeWorker.all[0]!.reply({ ok: true, stdout: '1\n' })
    await first
    const loop = runner.run('while True: pass', [])
    vi.advanceTimersByTime(5001)
    await expect(loop).resolves.toEqual({ kind: 'timeout' })
    expect(FakeWorker.all[0]!.terminated).toBe(true)
    void runner.run('print(3)', [])
    expect(FakeWorker.all).toHaveLength(2)
  })

  it('gives the first run (which downloads Python) a longer limit, then reports it as unavailable', async () => {
    const runner = make()
    const p = runner.run('print(1)', [])
    vi.advanceTimersByTime(5001)
    let settled = false
    void p.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    vi.advanceTimersByTime(60000)
    await expect(p).resolves.toMatchObject({ kind: 'unavailable' })
  })

  it('reports a load failure as unavailable', async () => {
    const runner = make()
    const p = runner.run('print(1)', [])
    FakeWorker.all[0]!.reply({ ok: false })
    await expect(p).resolves.toMatchObject({ kind: 'unavailable', message: expect.stringMatching(/couldn't load/) })
  })

  it('ignores a late reply from an earlier run', async () => {
    const runner = make()
    const p1 = runner.run('a', [])
    const w = FakeWorker.all[0]!
    w.reply({ ok: true, stdout: 'a' })
    await p1
    const p2 = runner.run('b', [])
    w.onmessage?.({ data: { id: 1, ok: true, stdout: 'stale', error: null, checks: [] } } as unknown as MessageEvent<RunResponse>)
    w.reply({ ok: true, stdout: 'b' })
    await expect(p2).resolves.toMatchObject({ stdout: 'b' })
  })
})
