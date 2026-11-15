import type { CheckResult, PyError, RunRequest, RunResponse } from './protocol'

export type RunOutcome =
  | { kind: 'ok'; stdout: string; error: PyError | null; checks: CheckResult[] }
  | { kind: 'timeout' }
  | { kind: 'unavailable'; message: string }

export interface Runner {
  run(code: string, tests: string[]): Promise<RunOutcome>
  dispose(): void
}

interface WorkerLike {
  postMessage(m: RunRequest): void
  terminate(): void
  onmessage: ((e: MessageEvent<RunResponse>) => void) | null
}

/** A run may take 5 seconds; the very first one also downloads Python, so it gets longer. */
export const RUN_LIMIT_MS = 5_000
export const FIRST_RUN_LIMIT_MS = 60_000

const defaultWorker = (): WorkerLike => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike

/**
 * Talks to the Python worker. A run that goes over the limit (an infinite loop, say) is stopped by ending
 * the worker; the next run starts a fresh one, so the page never freezes.
 */
export function createRunner(makeWorker: () => WorkerLike = defaultWorker, limits = { run: RUN_LIMIT_MS, first: FIRST_RUN_LIMIT_MS }): Runner {
  let worker: WorkerLike | null = null
  let loaded = false
  let next = 0
  return {
    run(code, tests) {
      worker ??= makeWorker()
      const w = worker
      const id = ++next
      return new Promise<RunOutcome>((resolve) => {
        const timer = setTimeout(() => {
          w.terminate()
          if (worker === w) worker = null
          resolve(loaded ? { kind: 'timeout' } : { kind: 'unavailable', message: 'Python took too long to load. Check the connection and try again.' })
        }, loaded ? limits.run : limits.first)
        w.onmessage = (e) => {
          if (e.data.id !== id) return
          clearTimeout(timer)
          if (!e.data.ok) return resolve({ kind: 'unavailable', message: "Python couldn't load on this device. Check the connection and try again." })
          loaded = true
          resolve({ kind: 'ok', stdout: e.data.stdout, error: e.data.error, checks: e.data.checks })
        }
        w.postMessage({ id, code, tests })
      })
    },
    dispose() {
      worker?.terminate()
      worker = null
    },
  }
}
