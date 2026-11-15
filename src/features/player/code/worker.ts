/// <reference lib="webworker" />
// Runs Python in its own thread with Pyodide (CPython compiled to WebAssembly), so a student's code can
// never freeze the page; an infinite loop is stopped by the page ending this worker. Nothing is sent to a
// server: the code, its output and the checks stay on the device.
import type { CheckResult, PyError, RunRequest, RunResponse } from './protocol'

// Pinned on Pyodide's own CDN path. Loaded only when a student opens a code activity.
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/'
const MAX_OUTPUT = 20_000

interface Py {
  runPythonAsync(code: string, opts: { globals: unknown }): Promise<unknown>
  runPython(code: string, opts: { globals: unknown }): unknown
  setStdout(o: { batched: (s: string) => void }): void
  setStderr(o: { batched: (s: string) => void }): void
  globals: { get(name: string): () => { destroy(): void } }
}
let ready: Promise<Py> | null = null

async function load(): Promise<Py> {
  const mod = (await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)) as { loadPyodide(o: { indexURL: string }): Promise<Py> }
  return mod.loadPyodide({ indexURL: PYODIDE_URL })
}

/** The last line of a Python traceback is "Type: message"; the line number is the last "<exec>" frame. */
function parse(err: unknown): PyError {
  const text = String((err as { message?: string })?.message ?? err).trim()
  const last = text.split('\n').pop() ?? text
  const m = /^([A-Za-z_][\w.]*):\s?(.*)$/.exec(last)
  const lines = [...text.matchAll(/File "<exec>", line (\d+)/g)]
  return { type: m?.[1] ?? 'Error', message: (m?.[2] ?? last).trim(), line: lines.length ? Number(lines[lines.length - 1]![1]) : null }
}

const NO_INPUT = `
def input(*args, **kwargs):
    raise RuntimeError("input() is not available here. Put the value straight into your code instead.")
`

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const { id, code, tests } = e.data
  let py: Py
  try {
    ready ??= load()
    py = await ready
  } catch (err) {
    ready = null
    self.postMessage({ id, ok: false, loadError: String(err) } satisfies RunResponse)
    return
  }
  let stdout = ''
  const write = (s: string) => { if (stdout.length < MAX_OUTPUT) stdout += `${s}\n` }
  py.setStdout({ batched: write })
  py.setStderr({ batched: write })
  const ns = py.globals.get('dict')()
  let error: PyError | null = null
  try {
    py.runPython(NO_INPUT, { globals: ns })
    await py.runPythonAsync(code, { globals: ns })
  } catch (err) {
    error = parse(err)
  }
  const checks: CheckResult[] = tests.map((test) => {
    if (error) return { test, passed: false, error: 'Fix the error above first.' }
    try {
      py.runPython(test, { globals: ns })
      return { test, passed: true }
    } catch (err) {
      const p = parse(err)
      return { test, passed: false, error: p.type === 'AssertionError' ? p.message || 'This check is not true yet.' : `${p.type}: ${p.message}` }
    }
  })
  ns.destroy()
  self.postMessage({ id, ok: true, stdout: stdout.slice(0, MAX_OUTPUT), error, checks } satisfies RunResponse)
}
